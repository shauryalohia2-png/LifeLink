'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Clock3, Copy, ExternalLink, Heart, HeartHandshake, Hospital, LogIn, LogOut, MapPin, Navigation, Phone, Search, ShieldCheck, UserRound, X, XCircle } from 'lucide-react';

type Bank = { id: string; name: string; lat: number; lon: number; address: string; phone: string; website: string; openingHours: string; category: string; source: string; distanceKm: number };
type SearchResponse = { searchedLocation: string; origin: { lat: number; lon: number }; results: Omit<Bank, 'distanceKm'>[]; message?: string; error?: string };
type Tab = 'Find blood banks' | 'Donate blood' | 'Request blood' | 'Organ donation';
type User = { id: string; permanentId: string; name: string; email: string | null; phone: string | null };

const ERaktKoshDirectory = 'https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt';
const ERaktKoshDonation = 'https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/onlineDonationRequest_epass.cnt';
const ERaktKoshDonorSignup = 'https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/portalDonorSignup.cnt';
const NOTTO = 'https://notto.mohfw.gov.in/';

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('Find blood banks');
  const [state, setState] = useState('Uttar Pradesh');
  const [city, setCity] = useState('Noida');
  const [sector, setSector] = useState('Sector 62');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [searchedLocation, setSearchedLocation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [bookingName, setBookingName] = useState('');
  const [bookingContact, setBookingContact] = useState('');
  const [bookingEmail, setBookingEmail] = useState('');
  const [bookingGroup, setBookingGroup] = useState('O+');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingHours, setBookingHours] = useState('Morning');
  const [bookingStatus, setBookingStatus] = useState('');
  const [requestForm, setRequestForm] = useState({ name: '', bloodGroup: 'O+', units: '1', hospital: '', phone: '' });
  const [requestSaved, setRequestSaved] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authChannel, setAuthChannel] = useState<'email' | 'phone'>('phone');
  const [authDestination, setAuthDestination] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [organForm, setOrganForm] = useState({ fullName: '', contact: '', email: '', topic: 'Organ donation guidance', institution: '', requestedAt: '', notes: '' });
  const [organSubmitting, setOrganSubmitting] = useState(false);
  const [organError, setOrganError] = useState('');
  const [organSuccess, setOrganSuccess] = useState('');
  const [scrollSearchOnTab, setScrollSearchOnTab] = useState(false);

  const sortedBanks = useMemo(() => [...banks].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10), [banks]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => setUser(data.user || null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === 'Find blood banks' && scrollSearchOnTab) {
      requestAnimationFrame(() => document.getElementById('search-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      setScrollSearchOnTab(false);
    }
  }, [tab, scrollSearchOnTab]);

  async function searchBanks(event?: FormEvent) {
    event?.preventDefault(); setLoading(true); setError(''); setMessage(''); setBanks([]); setSelectedBank(null);
    try {
      const params = new URLSearchParams({ state, city, sector });
      const response = await fetch(`/api/blood-banks?${params.toString()}`);
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(data.error || 'Search failed. Please try again.');
      const withDistance = data.results.map(bank => ({ ...bank, distanceKm: distanceKm(data.origin.lat, data.origin.lon, bank.lat, bank.lon) })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10);
      setBanks(withDistance); setSearchedLocation(data.searchedLocation); setMessage(data.message || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to search blood banks.'); }
    finally { setLoading(false); }
  }

  function openTab(next: Tab) { setTab(next); setSelectedBank(null); setBookingStatus(''); }
  function goToSearch() { setTab('Find blood banks'); setScrollSearchOnTab(true); }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(''); setAuthMessage(''); setAuthLoading(true); setDevOtp('');
    try {
      const response = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: authName, channel: authChannel, destination: authDestination }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send OTP.');
      setChallengeId(data.challengeId); setAuthMessage(data.message); setDevOtp(data.developmentOtp || '');
    } catch (e) { setAuthError(e instanceof Error ? e.message : 'Could not send OTP.'); }
    finally { setAuthLoading(false); }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(''); setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId, code: authCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OTP verification failed.');
      setUser(data.user); setAuthMessage(`Account created / signed in. Your permanent LifeLink ID is ${data.user.permanentId}.`); setChallengeId(''); setAuthCode(''); setDevOtp('');
    } catch (e) { setAuthError(e instanceof Error ? e.message : 'OTP verification failed.'); }
    finally { setAuthLoading(false); }
  }

  async function signOut() {
    await fetch('/api/auth/me', { method: 'DELETE' }); setUser(null); setAuthOpen(false);
  }

  function openBankAppointment(bank: Bank) {
    setSelectedBank(bank); setBookingStatus(''); setBookingName(user?.name || ''); setBookingContact(user?.phone || ''); setBookingEmail(user?.email || ''); setBookingDate(''); setBookingHours('Morning');
  }

  function continueToERaktKosh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBookingStatus('');
    const summary = [
      'LifeLink donor appointment details', `Name: ${bookingName}`, `Contact: ${bookingContact}`, `Email: ${bookingEmail || 'Not provided'}`,
      `Blood bank: ${selectedBank?.name || 'Choose a blood bank on e-RaktKosh'}`, `Preferred date: ${bookingDate}`, `Preferred visiting hours: ${bookingHours}`, `Blood group: ${bookingGroup}`,
      'Please confirm the appointment directly with the blood bank. This is not a confirmed booking.'
    ].join('\n');
    window.open(ERaktKoshDonation, '_blank', 'noopener,noreferrer');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary).then(() => setBookingStatus('Your details were copied. e-RaktKosh has opened in a new tab. Paste the details where relevant and complete any additional fields/verification on the official portal. Your appointment is not confirmed until the blood bank confirms it.')).catch(() => setBookingStatus('e-RaktKosh opened in a new tab. Clipboard access was unavailable, so enter your details manually.'));
    } else setBookingStatus('e-RaktKosh opened in a new tab. Enter your details manually.');
  }

  function submitBloodRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRequestError('');
    if (!requestForm.name.trim() || !requestForm.hospital.trim() || !requestForm.phone.trim()) { setRequestError('Complete all required fields.'); return; }
    setRequestSaved(true);
  }

  async function submitOrganAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setOrganError(''); setOrganSuccess(''); setOrganSubmitting(true);
    try {
      const response = await fetch('/api/organ-appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(organForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save appointment enquiry.');
      setOrganSuccess(`Request saved. Reference: ${data.referenceCode}. Status: pending review. This is an enquiry, not a confirmed hospital appointment.`);
      setOrganForm(v => ({ ...v, requestedAt: '', notes: '' }));
    } catch (e) { setOrganError(e instanceof Error ? e.message : 'Could not save appointment enquiry.'); }
    finally { setOrganSubmitting(false); }
  }

  const today = new Date().toISOString().slice(0, 16);

  return <main className="ll-shell">
    <header className="ll-header">
      <a className="ll-brand" href="#home" onClick={() => openTab('Find blood banks')}><span className="ll-logo"><HeartHandshake size={23}/></span><span>LifeLink<small>CONNECTING PEOPLE. SUPPORTING LIVES.</small></span></a>
      <nav className="ll-nav" aria-label="Main navigation">{(['Find blood banks', 'Donate blood', 'Request blood', 'Organ donation'] as Tab[]).map(item => <button key={item} className={tab === item ? 'is-active' : ''} onClick={() => openTab(item)}>{item}</button>)}</nav>
      {user ? <div className="ll-account-chip"><span><UserRound size={15}/>{user.name}</span><small>{user.permanentId}</small><button onClick={signOut} title="Sign out"><LogOut size={15}/></button></div> : <button className="ll-header-link" onClick={() => { setAuthOpen(true); setAuthError(''); setAuthMessage(''); }}><LogIn size={14}/> Sign up / Login</button>}
    </header>

    <section className="ll-hero" id="home">
      <div><div className="ll-eyebrow"><span/> HEALTHCARE DISCOVERY & COORDINATION</div><h1>Find the right blood bank.<br/><em>Closer. Faster.</em></h1><p>Search real mapped blood banks by state, city and sector. Compare their distance and contact centres directly to confirm availability.</p><div className="ll-hero-actions"><button className="ll-primary" onClick={goToSearch}>Find nearby blood banks <ArrowRight size={17}/></button><button className="ll-secondary" onClick={() => openTab('Donate blood')}>I want to donate</button></div><div className="ll-trust"><ShieldCheck size={16}/> Location results are sourced from OpenStreetMap; availability must be confirmed.</div></div>
      <div className="ll-hero-art"><div className="ll-orbit one"/><div className="ll-orbit two"/><div className="ll-drop"><Heart size={45} fill="white"/></div><div className="ll-float top"><MapPin size={17}/><span><b>Distance sorted</b><small>Nearest centres first</small></span></div><div className="ll-float bottom"><CheckCircle2 size={17}/><span><b>Transparent results</b><small>No invented live stock</small></span></div></div>
    </section>

    <div className="ll-notice"><Activity size={17}/><span><b>Important:</b> Map listings are not proof of licensing or current service. Blood stock and appointment availability are not inferred from map data. For official stock and donor registration, use e-RaktKosh.</span></div>

    <section className="ll-workspace" id="services">
      <div className="ll-section-head"><div><div className="ll-eyebrow muted">LIFELINK SERVICES</div><h2>What would you like to do?</h2><p>Each section below has its own working actions.</p></div><span className="ll-secure"><ShieldCheck size={15}/> Account-enabled prototype</span></div>
      <div className="ll-tabs">{(['Find blood banks', 'Donate blood', 'Request blood', 'Organ donation'] as Tab[]).map(item => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => openTab(item)}>{item === 'Find blood banks' ? <Search size={16}/> : item === 'Donate blood' ? <HeartHandshake size={16}/> : item === 'Request blood' ? <Hospital size={16}/> : <Heart size={16}/>} {item}</button>)}</div>

      {tab === 'Find blood banks' && <div id="search-panel" className="ll-find-panel">
        <form className="ll-location-form" onSubmit={searchBanks}>
          <label>STATE<input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Uttar Pradesh" required maxLength={100}/></label>
          <label>CITY<input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Noida" required maxLength={100}/></label>
          <label>SECTOR / LOCALITY <span className="optional">(optional)</span><input value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. Sector 62" maxLength={100}/></label>
          <button className="ll-primary search-button" type="submit" disabled={loading}>{loading ? <><span className="ll-spinner"/> Searching…</> : <><Search size={17}/> Search blood banks</>}</button>
        </form>
        <div className="ll-source-row"><span><MapPin size={15}/> Search radius: 40 km · maximum 10 results</span><span>Map data: OpenStreetMap contributors</span></div>
        {error && <div className="ll-error"><XCircle size={18}/>{error}</div>}
        {searchedLocation && <div className="ll-results-heading"><div><h3>Blood banks near your location</h3><p>{searchedLocation}</p></div><span className="ll-count">Showing {sortedBanks.length} · maximum 10 · nearest first</span></div>}
        {message && <div className="ll-empty">{message}</div>}
        {sortedBanks.length > 0 && <div className="ll-bank-list">{sortedBanks.map((bank, index) => <article className="ll-bank-card" key={bank.id}>
          <div className="ll-bank-icon"><Hospital size={22}/></div><div className="ll-bank-main"><div className="ll-bank-title"><h3>{bank.name}</h3><span>{bank.category === 'blood_donation' ? 'Donation facility · OSM' : 'Blood bank listing · OSM'}</span></div><p><MapPin size={14}/>{bank.address || 'Address not provided in map data'}</p><div className="ll-bank-meta"><span><Navigation size={14}/><b>{bank.distanceKm.toFixed(1)} km</b> away</span>{bank.openingHours && <span><Clock3 size={14}/>{bank.openingHours}</span>}</div><div className="ll-bank-actions">{bank.phone ? <a href={`tel:${bank.phone.replace(/[^+\d]/g, '')}`}><Phone size={15}/> Call {bank.phone}</a> : <span className="ll-no-phone">Phone not listed</span>}{bank.website && <a href={bank.website} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Website</a>}<a href={`https://www.google.com/maps/dir/?api=1&destination=${bank.lat},${bank.lon}`} target="_blank" rel="noreferrer"><Navigation size={15}/> Directions</a><button onClick={() => openBankAppointment(bank)}><CalendarDays size={15}/> Book / enquire</button></div></div><span className="ll-rank">#{index + 1}</span>
        </article>)}</div>}
        <div className="ll-official-box"><div><b>Need verified blood-bank details or current blood stock?</b><p>Use the Government of India's e-RaktKosh portal. It provides a blood-bank directory and stock search with last-updated information.</p></div><a href={ERaktKoshDirectory} target="_blank" rel="noreferrer">Open e-RaktKosh <ExternalLink size={15}/></a></div>
        <p className="ll-attribution">Location data © OpenStreetMap contributors · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Attribution and licence</a>. Map coverage may be incomplete. A missing result does not mean no blood bank exists.</p>
      </div>}

      {tab === 'Donate blood' && <div className="ll-two-col"><div className="ll-panel"><span className="ll-big-icon"><HeartHandshake size={27}/></span><h3>Register your intention to donate</h3><p>Choose a blood bank from search results and submit your name, contact, blood group and preferred visit date. LifeLink prepares a details sheet for the official portal.</p><ul><li><CheckCircle2 size={16}/> Search by your state, city and sector</li><li><CheckCircle2 size={16}/> Compare centres by distance</li><li><CheckCircle2 size={16}/> Copy your details and continue to e-RaktKosh</li></ul><button className="ll-primary" onClick={goToSearch}>Find a blood bank first <ArrowRight size={16}/></button><a className="ll-text-link" href={ERaktKoshDonorSignup} target="_blank" rel="noreferrer">e-RaktKosh donor sign-up <ExternalLink size={14}/></a></div><div className="ll-side-panel"><h3>About appointment details</h3><p>The official e-RaktKosh appointment form displays blood bank, tentative date, visiting hours and blood group fields. LifeLink cannot auto-fill a government website from another domain unless that portal exposes a supported prefill/API integration.</p><div className="ll-status warning"><Clock3 size={18}/><span><b>Not a confirmed booking</b><small>We copy your details for easy pasting, then open e-RaktKosh. The centre must confirm your visit.</small></span></div><a className="ll-text-link" href={ERaktKoshDonation} target="_blank" rel="noreferrer">Open official appointment form <ExternalLink size={14}/></a></div></div>}

      {tab === 'Request blood' && <div className="ll-two-col"><div className="ll-panel"><h3>Prepare a blood requirement enquiry</h3><p>Validate the details you need when contacting the treating hospital or a licensed blood centre. This prototype does not submit patient data or reserve blood.</p>{requestSaved ? <div className="ll-success"><CheckCircle2 size={20}/><div><b>Details checked</b><p>Nothing was transmitted or stored. Use the official stock portal and contact the hospital directly.</p></div><button onClick={() => setRequestSaved(false)}>Edit</button></div> : <form className="ll-form" onSubmit={submitBloodRequest}><label>Contact person<input value={requestForm.name} onChange={e => setRequestForm(v => ({ ...v, name: e.target.value }))} required/></label><label>Blood group<select value={requestForm.bloodGroup} onChange={e => setRequestForm(v => ({ ...v, bloodGroup: e.target.value }))}>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}</select></label><label>Units required<input type="number" min="1" max="20" value={requestForm.units} onChange={e => setRequestForm(v => ({ ...v, units: e.target.value }))} required/></label><label>Hospital / city<input value={requestForm.hospital} onChange={e => setRequestForm(v => ({ ...v, hospital: e.target.value }))} required/></label><label>Contact number<input type="tel" value={requestForm.phone} onChange={e => setRequestForm(v => ({ ...v, phone: e.target.value }))} required/></label>{requestError && <p className="ll-error-text">{requestError}</p>}<button className="ll-primary" type="submit">Validate details <ArrowRight size={16}/></button></form>}</div><div className="ll-side-panel"><h3>For urgent blood needs</h3><p>Ask the treating hospital's transfusion service to coordinate with licensed blood centres. Do not rely on map listings as proof of stock.</p><a className="ll-primary as-link" href={ERaktKoshDirectory} target="_blank" rel="noreferrer">Check official blood stock <ExternalLink size={15}/></a><div className="ll-status warning"><ShieldCheck size={18}/><span><b>No stock reservation</b><small>Confirm current stock, blood component and timings directly with the centre.</small></span></div></div></div>}

      {tab === 'Organ donation' && <div className="ll-organ"><div className="ll-panel"><span className="ll-big-icon purple"><Heart size={27}/></span><h3>Organ donation needs an authorized pathway.</h3><p>LifeLink provides education and referral requests only. It does not match donors with recipients, assess compatibility or influence organ allocation.</p><a className="ll-primary as-link" href={NOTTO} target="_blank" rel="noreferrer">Visit NOTTO official website <ExternalLink size={15}/></a><div className="ll-status warning"><ShieldCheck size={18}/><span><b>Consultation request only</b><small>We cannot confirm hospital appointments. The authorized institution must contact you.</small></span></div></div>
        <div className="ll-panel"><h3>Request an organ donation consultation</h3><p>Use this section for questions about pledging, family consent, deceased donation procedures or contacting a transplant coordinator. Do not submit urgent medical emergencies here.</p>
          {organSuccess ? <div className="ll-success"><CheckCircle2 size={20}/><div><b>Request received</b><p>{organSuccess}</p></div><button onClick={() => setOrganSuccess('')}>Close</button></div> : <form className="ll-form" onSubmit={submitOrganAppointment}>
            <label>Full name<input value={organForm.fullName} onChange={e => setOrganForm(v => ({ ...v, fullName: e.target.value }))} required maxLength={100}/></label>
            <label>Contact number<input type="tel" value={organForm.contact} onChange={e => setOrganForm(v => ({ ...v, contact: e.target.value }))} required maxLength={40} placeholder="+91..."/></label>
            <label>Email (optional)<input type="email" value={organForm.email} onChange={e => setOrganForm(v => ({ ...v, email: e.target.value }))}/></label>
            <label>Consultation topic<select value={organForm.topic} onChange={e => setOrganForm(v => ({ ...v, topic: e.target.value }))}>{['Organ donation guidance','Pledge / donor registration','Family consent and process','Deceased organ donation information','Transplant coordinator contact','Other organ donation query'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Preferred authorized hospital / institution<input value={organForm.institution} onChange={e => setOrganForm(v => ({ ...v, institution: e.target.value }))} placeholder="Optional"/></label>
            <label>Preferred date and time<input type="datetime-local" min={today} value={organForm.requestedAt} onChange={e => setOrganForm(v => ({ ...v, requestedAt: e.target.value }))} required/></label>
            <label className="ll-full-field">Additional details<textarea rows={3} value={organForm.notes} onChange={e => setOrganForm(v => ({ ...v, notes: e.target.value }))} maxLength={1000} placeholder="Briefly describe what you need help with"/></label>
            {organError && <p className="ll-error-text">{organError}</p>}
            <button className="ll-primary" type="submit" disabled={organSubmitting}>{organSubmitting ? 'Saving request…' : 'Submit consultation request'} <ArrowRight size={16}/></button>
          </form>}
        </div></div>}
    </section>

    <footer className="ll-footer"><a className="ll-brand" href="#home" onClick={() => openTab('Find blood banks')}><span className="ll-logo"><HeartHandshake size={20}/></span><span>LifeLink<small>CONNECTING PEOPLE. SUPPORTING LIVES.</small></span></a><span>Prototype · Not an emergency or medical service</span><a href={NOTTO} target="_blank" rel="noreferrer">NOTTO <ExternalLink size={13}/></a></footer>

    {selectedBank && <div className="ll-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedBank(null); }}><section className="ll-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-title"><button className="ll-modal-close" onClick={() => setSelectedBank(null)} aria-label="Close"><XCircle size={20}/></button><div className="ll-eyebrow muted">DONOR APPOINTMENT DETAILS</div><h3 id="appointment-title">{selectedBank.name}</h3><p>Enter the details you want to use on e-RaktKosh. LifeLink will copy them and open the official registration form. The external form may ask for additional fields or OTP verification.</p><form className="ll-form" onSubmit={continueToERaktKosh}>
      <label>Your name<input value={bookingName} onChange={e => setBookingName(e.target.value)} required maxLength={100}/></label>
      <label>Contact number<input type="tel" value={bookingContact} onChange={e => setBookingContact(e.target.value)} required placeholder="+91..."/></label>
      <label>Email (optional)<input type="email" value={bookingEmail} onChange={e => setBookingEmail(e.target.value)}/></label>
      <label>Blood group<select value={bookingGroup} onChange={e => setBookingGroup(e.target.value)}>{['A+','A-','B+','B-','O+','O-','AB+','AB-','Not sure'].map(g => <option key={g}>{g}</option>)}</select></label>
      <label>Preferred donation date<input type="date" value={bookingDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setBookingDate(e.target.value)} required/></label>
      <label>Preferred visiting hours<select value={bookingHours} onChange={e => setBookingHours(e.target.value)}>{['Morning','Afternoon','Evening','As per centre availability'].map(h => <option key={h}>{h}</option>)}</select></label>
      <button className="ll-primary" type="submit"><Copy size={15}/> Copy details & open e-RaktKosh <ArrowRight size={16}/></button>
    </form>{bookingStatus && <div className="ll-status"><CheckCircle2 size={18}/><span>{bookingStatus}</span></div>}<div className="ll-modal-links">{selectedBank.phone && <a href={`tel:${selectedBank.phone.replace(/[^+\d]/g, '')}`}><Phone size={15}/> Call centre</a>}<a href={ERaktKoshDonorSignup} target="_blank" rel="noreferrer"><ExternalLink size={15}/> e-RaktKosh donor sign-up</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedBank.lat},${selectedBank.lon}`} target="_blank" rel="noreferrer"><Navigation size={15}/> Directions</a></div></section></div>}

    {authOpen && <div className="ll-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}><section className="ll-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="ll-modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X size={20}/></button><div className="ll-eyebrow muted">LIFELINK ACCOUNT</div><h3 id="auth-title">Sign up or log in with OTP</h3>{user ? <div className="ll-success"><CheckCircle2 size={20}/><div><b>You're signed in</b><p>Permanent LifeLink ID: {user.permanentId}</p></div></div> : !challengeId ? <form className="ll-form" onSubmit={sendOtp}>
      <label>Full name<input value={authName} onChange={e => setAuthName(e.target.value)} required maxLength={100}/></label>
      <label>Verify using<select value={authChannel} onChange={e => { setAuthChannel(e.target.value as 'email' | 'phone'); setAuthDestination(''); }}><option value="phone">Mobile number + SMS OTP</option><option value="email">Email + OTP</option></select></label>
      <label>{authChannel === 'phone' ? 'Mobile number (include country code)' : 'Email address'}<input value={authDestination} onChange={e => setAuthDestination(e.target.value)} required type={authChannel === 'email' ? 'email' : 'tel'} placeholder={authChannel === 'phone' ? '+919876543210' : 'you@example.com'}/></label>
      <button className="ll-primary" type="submit" disabled={authLoading}>{authLoading ? 'Sending OTP…' : 'Send OTP'} <ArrowRight size={16}/></button>
    </form> : <form className="ll-form" onSubmit={verifyOtp}>
      <p className="ll-form-note">Enter the six-digit code sent to {authDestination}.</p>
      {devOtp && <div className="ll-dev-otp">Local development OTP: <b>{devOtp}</b></div>}
      <label>One-time password<input value={authCode} onChange={e => setAuthCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="6-digit OTP"/></label>
      <button className="ll-primary" type="submit" disabled={authLoading || authCode.length !== 6}>{authLoading ? 'Verifying…' : 'Verify OTP & create account'} <ArrowRight size={16}/></button>
      <button type="button" className="ll-text-button" onClick={() => { setChallengeId(''); setAuthCode(''); setAuthMessage(''); setDevOtp(''); }}>Change contact / resend OTP</button>
    </form>}
    {authMessage && <div className="ll-status"><CheckCircle2 size={17}/><span>{authMessage}</span></div>}{authError && <div className="ll-error"><XCircle size={17}/>{authError}</div>}{user && <div className="ll-modal-links"><button onClick={signOut} className="ll-text-button"><LogOut size={15}/> Sign out</button><button onClick={() => setAuthOpen(false)} className="ll-text-button">Close</button></div>}</section></div>}
  </main>;
}
