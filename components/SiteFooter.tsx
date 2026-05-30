import Link from 'next/link';

const QUICK = [
	{ label: 'Home', href: '/' },
	{ label: 'How It Works', href: '/how-it-works' },
	{ label: 'For Health Workers', href: '/chw' },
	{ label: 'Technology', href: '/technology' },
	{ label: 'Impact', href: '/impact' },
];

const RESOURCES = [
	{ label: 'Documentation', href: '/docs' },
	{ label: 'Research', href: '/docs' },
	{ label: 'Guidelines', href: '/docs' },
	{ label: 'Privacy Policy', href: '/docs' },
	{ label: 'Terms of Use', href: '/docs' },
];

export function SiteFooter() {
	return (
		<footer className='border-t border-pulmo-surface bg-pulmo-deep text-slate-200'>
			<div className='mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4'>
				<div>
					<div className='flex items-baseline gap-2'>
						<span className='text-xl font-bold text-white'>Baby Pulmo</span>
						<span className='text-xs uppercase tracking-wider text-slate-400'>
							Child&apos;s Voice
						</span>
					</div>
					<p className='mt-3 max-w-xs text-sm text-slate-400'>
						AI Pediatric Cough Diagnostic for Rural Bangladesh. Empowering
						health workers and caregivers.
					</p>
					<div className='mt-4 flex gap-3' aria-label='Social links'>
						<SocialIcon label='GitHub' href='https://github.com/BabyPulmo' />
						<SocialIcon label='Email' href='mailto:hello@babypulmo.com' />
						<SocialIcon label='Podcast' href='#' />
						<SocialIcon label='YouTube' href='#' />
					</div>
				</div>
				<div>
					<h3 className='text-xs font-semibold uppercase tracking-wider text-slate-400'>
						Quick Links
					</h3>
					<ul className='mt-3 space-y-2 text-sm'>
						{QUICK.map((q) => (
							<li key={q.href}>
								<Link href={q.href} className='text-slate-300 hover:text-white'>
									{q.label}
								</Link>
							</li>
						))}
					</ul>
				</div>
				<div>
					<h3 className='text-xs font-semibold uppercase tracking-wider text-slate-400'>
						Resources
					</h3>
					<ul className='mt-3 space-y-2 text-sm'>
						{RESOURCES.map((r) => (
							<li key={r.label}>
								<Link href={r.href} className='text-slate-300 hover:text-white'>
									{r.label}
								</Link>
							</li>
						))}
					</ul>
				</div>
				<div>
					<h3 className='text-xs font-semibold uppercase tracking-wider text-slate-400'>
						Contact
					</h3>
					<ul className='mt-3 space-y-2 text-sm text-slate-300'>
						<li>✉ hello@babypulmo.com</li>
						<li>☏ +880 1724111475</li>
						<li>📍 Dhaka, Bangladesh</li>
					</ul>
				</div>
			</div>
			<div className='border-t border-slate-700/40 bg-pulmo-deep'>
				<div className='mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-slate-500 sm:flex-row'>
					<span>© 2026 Baby Pulmo. All rights reserved.</span>
					<span>Designed for Rural Health · v1.0.2 Stable</span>
				</div>
			</div>
		</footer>
	);
}

function SocialIcon({ label, href }: { label: string; href: string }) {
	return (
		<a
			href={href}
			aria-label={label}
			className='flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 text-slate-400 transition hover:border-white hover:text-white'
		>
			<span className='text-xs'>{label[0]}</span>
		</a>
	);
}
