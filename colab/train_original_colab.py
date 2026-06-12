# Baby Pulmo — ORIGINAL full-fidelity pipeline, made runnable on Colab (2026)
# ===========================================================================
# Same design as colab/train_wav2vec2.py:
#   • facebook/wav2vec2-large-xlsr-53
#   • 6 classes: healthy, common_cold, bronchiolitis, pneumonia, asthma, croup
#   • fused Coswara + COUGHVID + ICBHI, pediatric (age<=5) where present
#   • 50-2500 Hz bandpass + 5 s window + SpecAugment + weighted-CE, 5 epochs
#   • FP32 -> int8 ONNX export
#
# What changed vs the literal original (so it actually runs in 2026):
#   1. Pure-Python downloads (no !pip/!wget/!git magics) -> runs via `!python`.
#   2. ICBHI sourcing: Kaggle (if kaggle.json) -> auth.gr w/ TLS-verify off -> skip.
#   3. Pediatric-filter CONTINGENCY: if the fused set is too small / a class is
#      empty, auto-relax age<=5 -> <=12 -> all ages, logged honestly.
#   4. T4 fitting: fp16 + frozen encoder; auto-fallback to wav2vec2-base on OOM.
#
# Run on Colab (T4):   !python train_original_colab.py
# ===========================================================================

import os, sys, json, glob, ssl, zipfile, urllib.request, subprocess, random
import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42
random.seed(SEED); np.random.seed(SEED)

# Toggle datasets (all on = faithful to the original). Coswara is the heaviest
# clone with the least pediatric yield — set False to save time if needed.
USE_COSWARA  = True
USE_COUGHVID = True
USE_ICBHI    = True

MODEL_NAME = "facebook/wav2vec2-large-xlsr-53"
PEDIATRIC_MAX_AGE_YEARS = 5
MIN_TOTAL = 300            # below this, relax the age filter
MAX_PER_CLASS = 800        # cap for tractable training

LABEL2ID = {"healthy":0,"common_cold":1,"bronchiolitis":2,"pneumonia":3,"asthma":4,"croup":5}
ID2LABEL = {v:k for k,v in LABEL2ID.items()}

TARGET_SR = 16000
SEGMENT_LEN = TARGET_SR * 5

# ---------------------------------------------------------------------------
# Downloads (pure Python)
# ---------------------------------------------------------------------------
def sh(cmd):
    print("  $", " ".join(cmd));
    return subprocess.run(cmd, capture_output=True, text=True)

def dl(url, path, verify=True):
    ctx = None if verify else ssl._create_unverified_context()
    print(f"  downloading {url} -> {path}")
    with urllib.request.urlopen(url, context=ctx, timeout=60) as r, open(path,"wb") as f:
        total = int(r.headers.get("Content-Length", 0)); done = 0
        while True:
            chunk = r.read(1<<20)
            if not chunk: break
            f.write(chunk); done += len(chunk)
            if total: print(f"    {done/1e6:7.0f}/{total/1e6:.0f} MB", end="\r")
    print()

def get_coswara():
    if not USE_COSWARA: return
    if Path("Coswara-Data/Extracted_data").exists():
        print("[coswara] present"); return
    print("[coswara] cloning (large, several minutes)…")
    sh(["git","clone","--depth","1","https://github.com/iiscleap/Coswara-Data.git"])
    if Path("Coswara-Data/extract_data.py").exists():
        print("[coswara] extracting… (~15 min)")
        subprocess.run([sys.executable, "extract_data.py"], cwd="Coswara-Data")

def get_coughvid():
    if not USE_COUGHVID: return
    if Path("coughvid/public_dataset").exists() or glob.glob("coughvid/**/metadata_compiled.csv", recursive=True):
        print("[coughvid] present"); return
    os.makedirs("coughvid", exist_ok=True)
    try:
        dl("https://zenodo.org/record/4498364/files/public_dataset.zip","coughvid.zip")
        print("[coughvid] extracting…")
        with zipfile.ZipFile("coughvid.zip") as z: z.extractall("coughvid")
    except Exception as e:
        print("[coughvid] FAILED:", e)

def get_icbhi():
    if not USE_ICBHI: return
    if glob.glob("icbhi/**/patient_diagnosis*.*", recursive=True):
        print("[icbhi] present"); return
    os.makedirs("icbhi", exist_ok=True)
    # (a) Kaggle if a token was uploaded
    kj = None
    for c in ("/content/kaggle.json", os.path.expanduser("~/.kaggle/kaggle.json"), "kaggle.json"):
        if os.path.exists(c): kj = c; break
    if kj:
        try:
            print("[icbhi] trying Kaggle…")
            os.makedirs(os.path.expanduser("~/.kaggle"), exist_ok=True)
            if kj != os.path.expanduser("~/.kaggle/kaggle.json"):
                import shutil; shutil.copy(kj, os.path.expanduser("~/.kaggle/kaggle.json"))
            os.chmod(os.path.expanduser("~/.kaggle/kaggle.json"), 0o600)
            subprocess.run([sys.executable,"-m","pip","install","-q","kaggle"])
            r = subprocess.run(["kaggle","datasets","download","-d",
                "vbookshelf/respiratory-sound-database","-p","icbhi","--unzip"],
                capture_output=True, text=True)
            print(r.stdout[-500:], r.stderr[-500:])
            if glob.glob("icbhi/**/patient_diagnosis*.*", recursive=True):
                print("[icbhi] Kaggle OK"); return
        except Exception as e:
            print("[icbhi] Kaggle failed:", e)
    # (b) auth.gr mirror with TLS verification disabled
    try:
        print("[icbhi] trying auth.gr mirror (TLS verify off)…")
        dl("https://bhichallenge.med.auth.gr/sites/default/files/ICBHI_final_database/ICBHI_final_database.zip",
           "icbhi.zip", verify=False)
        with zipfile.ZipFile("icbhi.zip") as z: z.extractall("icbhi")
        print("[icbhi] mirror OK"); return
    except Exception as e:
        print("[icbhi] mirror failed:", e)
    print("[icbhi] SKIPPED — no clinical-label source available.")

# ---------------------------------------------------------------------------
# Loaders (label-mapping preserved from the original train_wav2vec2.py)
# ---------------------------------------------------------------------------
def load_coswara(max_age):
    root = Path("Coswara-Data/Extracted_data")
    if not root.exists(): return []
    out=[]
    for date_dir in root.iterdir():
        if not date_dir.is_dir(): continue
        for subj in date_dir.iterdir():
            mp = subj/"metadata.json"
            if not mp.exists(): continue
            try: meta=json.loads(mp.read_text())
            except Exception: continue
            a=meta.get("a")
            try: age=float(a) if a is not None else None
            except (TypeError,ValueError): age=None
            if age is None or age>max_age: continue
            files=sorted(glob.glob(str(subj/"cough-heavy.wav")))+sorted(glob.glob(str(subj/"cough-shallow.wav")))
            if not files: continue
            covid=meta.get("covid_status",""); asthma=bool(meta.get("asthma",False))
            cold=bool(meta.get("cold",False)); cough=bool(meta.get("cough",False))
            if asthma: lab="asthma"
            elif covid in ("positive_mild","positive_moderate","positive_severe"): lab="pneumonia"
            elif cold: lab="common_cold"
            elif covid=="healthy" and not (cold or cough): lab="healthy"
            else: continue
            for f in files: out.append({"audio_path":f,"label":lab})
    return out

def load_coughvid(max_age):
    hits=glob.glob("coughvid/**/metadata_compiled.csv", recursive=True)
    if not hits: return []
    root=Path(hits[0]).parent
    df=pd.read_csv(root/"metadata_compiled.csv")
    if "age" in df.columns:
        df=df[df["age"].fillna(99).astype(float)<=max_age]
    out=[]
    for _,row in df.iterrows():
        uuid=row.get("uuid")
        if not uuid: continue
        wav=root/f"{uuid}.wav"
        if not wav.exists():
            for ext in (".webm",".ogg"):
                p=root/f"{uuid}{ext}"
                if p.exists(): wav=p; break
            else: continue
        dx=(str(row.get("diagnosis") or row.get("dx_1") or "")).lower()
        rc=str(row.get("respiratory_condition","")).lower()
        if "pneumonia" in dx: lab="pneumonia"
        elif "bronchiolitis" in dx: lab="bronchiolitis"
        elif "asthma" in dx or "asthma" in rc: lab="asthma"
        elif "croup" in dx: lab="croup"
        elif "cold" in dx or "upper_infection" in dx: lab="common_cold"
        elif rc in ("false","no","") and dx in ("","healthy_cough"): lab="healthy"
        else: continue
        out.append({"audio_path":str(wav),"label":lab})
    return out

def load_icbhi(max_age):
    diag_files=glob.glob("icbhi/**/patient_diagnosis*.*", recursive=True)
    if not diag_files: return []
    base=Path(diag_files[0]).parent
    diag={}
    txt=Path(diag_files[0]).read_text()
    for line in txt.splitlines():
        p=line.replace(","," ").split()
        if len(p)>=2 and p[0].isdigit(): diag[p[0]]=p[1].lower()
    demo={}
    demo_files=glob.glob("icbhi/**/demographic_info.txt", recursive=True)
    if demo_files:
        for line in Path(demo_files[0]).read_text().splitlines():
            p=line.split()
            if len(p)>=2:
                try: demo[p[0]]=float(p[1])
                except ValueError: pass
    d2l={"healthy":"healthy","pneumonia":"pneumonia","bronchiolitis":"bronchiolitis",
         "asthma":"asthma","urti":"common_cold","lrti":"common_cold"}
    out=[]
    for wav in glob.glob(str(base/"**"/"*.wav"), recursive=True):
        pid=Path(wav).name.split("_",1)[0]
        age=demo.get(pid)
        if age is not None and age>max_age: continue   # keep if age unknown
        lab=d2l.get(diag.get(pid,""))
        if not lab: continue
        out.append({"audio_path":wav,"label":lab})
    return out

def build_dataset():
    for max_age,tag in [(PEDIATRIC_MAX_AGE_YEARS,"<=5"),(12,"<=12"),(999,"all-ages")]:
        recs=[]
        if USE_COSWARA: recs+=load_coswara(max_age)
        if USE_COUGHVID: recs+=load_coughvid(max_age)
        if USE_ICBHI: recs+=load_icbhi(max_age)
        df=pd.DataFrame(recs)
        n=len(df); per=df["label"].value_counts().to_dict() if n else {}
        ok = n>=MIN_TOTAL and len([c for c in per if per[c]>=2])>=2
        print(f"[data] age filter {tag}: {n} samples, by class={per}")
        if ok or max_age==999:
            if tag!="<=5": print(f"[data] CONTINGENCY: relaxed pediatric filter to {tag} (logged — not strictly pediatric).")
            # drop classes with <2 samples so stratify won't crash; cap per class
            keep=[c for c in per if per[c]>=2]
            df=df[df["label"].isin(keep)]
            df=df.groupby("label",group_keys=False).apply(
                lambda g:g.sample(n=min(len(g),MAX_PER_CLASS),random_state=SEED)).reset_index(drop=True)
            return df
    return pd.DataFrame()

# ---------------------------------------------------------------------------
# Train
# ---------------------------------------------------------------------------
def main():
    import torch, torch.nn as nn
    from scipy.signal import butter, sosfiltfilt
    import librosa
    from datasets import Dataset
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, confusion_matrix
    from transformers import (Wav2Vec2FeatureExtractor, Wav2Vec2ForSequenceClassification,
                              TrainingArguments, Trainer)

    print("[env] cuda:", torch.cuda.is_available(),
          torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")
    get_coswara(); get_coughvid(); get_icbhi()
    df=build_dataset()
    if len(df)==0:
        sys.exit("[fatal] no usable training data from any dataset.")
    present=sorted(df["label"].unique(), key=lambda c:LABEL2ID[c])
    local2id={c:i for i,c in enumerate(present)}
    id2local={i:c for c,i in local2id.items()}
    df["label_id"]=df["label"].map(local2id)
    print(f"[data] FINAL: {len(df)} samples across {len(present)} classes: {present}")

    sos=butter(4,[50.0,2500.0],btype="bandpass",fs=TARGET_SR,output="sos")
    def load_audio(p):
        try: w,_=librosa.load(p,sr=TARGET_SR,mono=True)
        except Exception: return None
        if len(w)<16: return None
        w=sosfiltfilt(sos,w).astype(np.float32)
        if len(w)>SEGMENT_LEN:
            s=(len(w)-SEGMENT_LEN)//2; w=w[s:s+SEGMENT_LEN]
        else:
            pad=np.zeros(SEGMENT_LEN,dtype=np.float32); pad[:len(w)]=w; w=pad
        return w
    print("[data] decoding audio…")
    X,y=[],[]
    for _,r in df.iterrows():
        a=load_audio(r["audio_path"])
        if a is not None: X.append(a); y.append(int(r["label_id"]))
    print(f"[data] decoded {len(X)} samples")

    Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.2,stratify=y,random_state=SEED)
    def to_ds(X,y): return Dataset.from_dict({"input_values":[a.tolist() for a in X],"labels":y})
    train_ds,test_ds=to_ds(Xtr,ytr),to_ds(Xte,yte)

    counts=np.bincount(ytr,minlength=len(present))
    class_w=torch.tensor(counts.sum()/(len(counts)*np.maximum(counts,1)),dtype=torch.float32)

    def build_model(name):
        m=Wav2Vec2ForSequenceClassification.from_pretrained(
            name,num_labels=len(present),id2label=id2local,label2id=local2id,
            mask_time_prob=0.08,mask_time_length=10,mask_feature_prob=0.05,mask_feature_length=10)
        try: m.freeze_feature_encoder()
        except AttributeError: m.freeze_feature_extractor()
        return m

    class WTrainer(Trainer):
        def compute_loss(self,model,inputs,return_outputs=False,**kw):
            labels=inputs.pop("labels"); out=model(**inputs)
            loss=nn.CrossEntropyLoss(weight=class_w.to(out.logits.device))(out.logits,labels)
            return (loss,out) if return_outputs else loss

    def make_args(bs,ga):
        return TrainingArguments(output_dir="/content/bp_model",num_train_epochs=5,
            per_device_train_batch_size=bs,per_device_eval_batch_size=bs,
            gradient_accumulation_steps=ga,learning_rate=3e-5,warmup_ratio=0.1,
            lr_scheduler_type="cosine",eval_strategy="epoch",save_strategy="no",
            logging_steps=20,fp16=torch.cuda.is_available(),report_to="none",seed=SEED)

    used_model=MODEL_NAME
    try:
        model=build_model(MODEL_NAME)
        trainer=WTrainer(model=model,args=make_args(4,2),train_dataset=train_ds,eval_dataset=test_ds)
        trainer.train()
    except torch.cuda.OutOfMemoryError:
        print("[oom] XLSR-53 OOM on this GPU — falling back to wav2vec2-base (logged).")
        torch.cuda.empty_cache(); used_model="facebook/wav2vec2-base"
        model=build_model(used_model)
        trainer=WTrainer(model=model,args=make_args(8,1),train_dataset=train_ds,eval_dataset=test_ds)
        trainer.train()

    preds=np.argmax(trainer.predict(test_ds).predictions,axis=1)
    print(f"\n==== HONEST TEST METRICS (model={used_model}) ====")
    print(classification_report(yte,preds,target_names=present,zero_division=0))
    print("confusion matrix:\n",confusion_matrix(yte,preds))

    model.eval().cpu()
    dummy=torch.zeros(1,SEGMENT_LEN,dtype=torch.float32)
    torch.onnx.export(model,(dummy,),"/content/babypulmo_wav2vec2.onnx",
        input_names=["input_values"],output_names=["logits"],
        dynamic_axes={"input_values":{0:"batch"},"logits":{0:"batch"}},opset_version=14)
    from onnxruntime.quantization import quantize_dynamic,QuantType
    quantize_dynamic("/content/babypulmo_wav2vec2.onnx","/content/babypulmo_wav2vec2_int8.onnx",weight_type=QuantType.QInt8)
    mb=os.path.getsize("/content/babypulmo_wav2vec2_int8.onnx")/1e6
    print(f"\n[export] babypulmo_wav2vec2_int8.onnx ({mb:.1f} MB), label order:")
    print(json.dumps(id2local,indent=2))
    with open("/content/babypulmo_labels.json","w") as f: json.dump(id2local,f)
    try:
        from google.colab import files
        files.download("/content/babypulmo_wav2vec2_int8.onnx"); files.download("/content/babypulmo_labels.json")
    except Exception:
        print("[export] files are in /content (download from the Files panel).")

if __name__=="__main__":
    main()
