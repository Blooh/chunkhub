// Chunk Hub accounts: sign in / create account (email + password, or Google) through Supabase,
// the avatar menu in the top bar, the My Account page, and syncing checklist progress to the account.
// Settings live in lib/account-config.js. Until those are filled in, the Sign In button shows "coming soon".
(function () {
  'use strict';
  const me = document.currentScript, ROOT = (me && me.dataset.root) || '';
  const wrap = document.querySelector('.site-head .account');
  if (!wrap) return;
  const btn = wrap.querySelector('.signin'), pop = wrap.querySelector('.signin-pop');
  const cfg = window.CHUNKHUB_AUTH || {};
  const ready = cfg.url && cfg.key && window.supabase && window.supabase.createClient;

  // ---------- small helpers ----------
  const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
  const esc = s => String(s == null ? '' : s);
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  function setPop(open) { pop.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  btn.addEventListener('click', e => { e.stopPropagation(); if (!ready || !user) { if (ready) openAuth('in'); else setPop(pop.hidden); } else setPop(pop.hidden); });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) setPop(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setPop(false); closeAuth(); } });
  if (!ready) return; // not configured yet: keep the "coming soon" note

  const sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  window.chunkhubAuth = sb;
  let user = null;

  // ---------- styles for the sign-in window, avatar menu and account page ----------
  document.head.append(h('style', {}, `
.auth-modal { position: fixed; inset: 0; z-index: 80; background: rgba(8,10,14,.6); display: grid; place-items: center; padding: 16px; animation: au-fade .16s ease-out; }
.auth-modal[hidden] { display: none; }
.auth-card { position: relative; width: 100%; max-width: 400px; background: #141416; color: #e4e4e7; border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 26px; box-shadow: 0 24px 70px rgba(0,0,0,.5); font-family: Calibri, Carlito, system-ui, sans-serif; max-height: calc(100vh - 32px); overflow: auto; }
.auth-card h2 { margin: 0 0 4px; font-size: 22px; color: #fff; font-family: inherit; border: 0; padding: 0; text-transform: none; letter-spacing: 0; }
.auth-card .sub { margin: 0 0 18px; color: #a1a1aa; font-size: 14px; }
.auth-x { position: absolute; top: 12px; right: 12px; background: none; border: 0; color: #a1a1aa; font-size: 22px; cursor: pointer; padding: 4px 8px; line-height: 1; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; background: #1f1f23; border-radius: 10px; padding: 3px; margin-bottom: 16px; }
.auth-tabs button { background: none; border: 0; color: #a1a1aa; font: inherit; font-weight: 600; padding: 8px; border-radius: 8px; cursor: pointer; }
.auth-tabs button[aria-selected="true"] { background: #2c2c32; color: #fff; }
.auth-google { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: #fff; color: #1f1f1f; border: 0; border-radius: 10px; padding: 11px; font: inherit; font-weight: 700; cursor: pointer; }
.auth-google:hover { background: #f1f1f1; }
.auth-or { display: flex; align-items: center; gap: 10px; color: #71717a; font-size: 12px; margin: 14px 0; }
.auth-or::before, .auth-or::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,.1); }
.auth-card form { display: flex; flex-direction: column; gap: 10px; }
.auth-card label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: #a1a1aa; }
.auth-card input[type=email], .auth-card input[type=password], .auth-card input[type=text] { font: inherit; font-size: 16px; color: #fff; background: #1f1f23; border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 10px 12px; }
.auth-card input:focus { outline: 2px solid #ff3b30; outline-offset: 1px; }
.auth-card .chk { flex-direction: row; align-items: flex-start; gap: 8px; line-height: 1.35; }
.auth-card .chk a { color: #e4e4e7; }
.auth-go { background: #d32f2f; color: #fff; border: 0; border-radius: 10px; padding: 11px; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; margin-top: 4px; }
.auth-go:hover { background: #e53935; }
.auth-go[disabled] { opacity: .6; cursor: wait; }
.auth-link { background: none; border: 0; color: #a1a1aa; font: inherit; font-size: 14px; text-decoration: underline; cursor: pointer; padding: 0; align-self: flex-start; }
.auth-msg { margin: 0; font-size: 14px; min-height: 1em; }
.auth-msg.err { color: #ff8a80; } .auth-msg.ok { color: #7ee2a8; }
@keyframes au-fade { from { opacity: 0; } }
.site-head .signin-pop.menu-in { padding: 6px; gap: 0; width: 240px; }
.site-head .signin-pop .who { padding: 8px 10px 10px; border-bottom: 1px solid rgba(255,255,255,.08); margin-bottom: 4px; }
.site-head .signin-pop .who b { display: block; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site-head .signin-pop .who span { font-size: 13px; color: #a1a1aa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.site-head .signin-pop .mi { display: block; width: 100%; text-align: left; background: none; border: 0; color: #d4d4d8; font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 9px; text-decoration: none; cursor: pointer; }
.site-head .signin-pop .mi:hover { background: rgba(255,255,255,.07); color: #fff; }
.site-head .avatar .ini { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 700; color: #fff; background: #b3261e; font-size: 16px; }
.site-head .signin.in .avatar { place-items: center; }
.acct { display: flex; flex-direction: column; gap: 16px; max-width: 640px; padding-bottom: 24px; }
.acct .prow { display: flex; align-items: center; gap: 16px; }
.acct .big-av { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: #b3261e; color: #fff; display: grid; place-items: center; font-size: 30px; font-weight: 700; flex: none; }
.acct .big-av img { width: 100%; height: 100%; object-fit: cover; }
.acct .pic-ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.acct h2 { margin: 0; font-size: 22px; }
.acct .muted { color: var(--muted, #888); margin: 0; }
.acct form { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.acct form label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: var(--muted, #888); flex: 1; min-width: 200px; }
.acct .danger { color: #d32f2f; }
.acct .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
`));

  // ---------- sign in / create account window ----------
  let modal = null, mode = 'in';
  const msg = (text, kind = 'err') => { const m = modal.querySelector('.auth-msg'); m.textContent = text; m.className = 'auth-msg ' + kind; };
  const friendly = e => {
    const t = (e && e.message) || String(e || '');
    if (/invalid login credentials/i.test(t)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(t)) return 'Please confirm your email first. Check your inbox for the link.';
    if (/already registered|already been registered/i.test(t)) return 'There’s already an account with that email. Try signing in.';
    if (/password should be at least/i.test(t)) return 'Your password needs at least 8 characters.';
    if (/rate limit|too many/i.test(t)) return 'Too many tries. Please wait a minute and try again.';
    return t || 'Something went wrong. Please try again.';
  };
  const G = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  function view() {
    const card = modal.querySelector('.auth-card'); card.innerHTML = '';
    card.append(h('button', { type: 'button', class: 'auth-x', 'aria-label': 'Close', onclick: closeAuth }, '×'));
    if (mode === 'reset' || mode === 'newpw') {
      card.append(h('h2', { id: 'authTitle' }, mode === 'reset' ? 'Reset your password' : 'Choose a new password'),
        h('p', { class: 'sub' }, mode === 'reset' ? 'We’ll email you a link to set a new password.' : 'Enter a new password for your account.'));
      const f = h('form', { novalidate: true },
        mode === 'reset' ? h('label', {}, 'Email', h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true })) : h('label', {}, 'New password', h('input', { type: 'password', name: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
        h('button', { class: 'auth-go', type: 'submit' }, mode === 'reset' ? 'Send reset link' : 'Save password'),
        mode === 'reset' ? h('button', { type: 'button', class: 'auth-link', onclick: () => { mode = 'in'; view(); } }, 'Back to sign in') : null,
        h('p', { class: 'auth-msg', role: 'alert' }));
      f.addEventListener('submit', async e => {
        e.preventDefault(); const go = f.querySelector('.auth-go'); go.disabled = true;
        try {
          if (mode === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + '/account/index.html' }); if (error) throw error; msg('If that email has an account, a reset link is on its way.', 'ok'); }
          else { if (f.password.value.length < 8) throw new Error('Password should be at least 8 characters'); const { error } = await sb.auth.updateUser({ password: f.password.value }); if (error) throw error; msg('Password saved. You’re signed in.', 'ok'); setTimeout(closeAuth, 1200); }
        } catch (err) { msg(friendly(err)); } finally { go.disabled = false; }
      });
      card.append(f); setTimeout(() => f.querySelector('input').focus(), 0); return;
    }
    const isUp = mode === 'up';
    card.append(h('h2', { id: 'authTitle' }, isUp ? 'Create your account' : 'Welcome back'),
      h('p', { class: 'sub' }, isUp ? 'Save your checklist progress and use it on any device.' : 'Sign in to sync your checklists.'));
    const tabs = h('div', { class: 'auth-tabs', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(!isUp), onclick: () => { mode = 'in'; view(); } }, 'Sign in'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(isUp), onclick: () => { mode = 'up'; view(); } }, 'Create account'));
    const gbtn = h('button', { type: 'button', class: 'auth-google' }); gbtn.innerHTML = G + '<span>Continue with Google</span>';
    gbtn.onclick = async () => { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } }); if (error) msg(friendly(error)); };
    const f = h('form', { novalidate: true },
      isUp ? h('label', {}, 'Display name', h('input', { type: 'text', name: 'name', autocomplete: 'nickname', maxlength: 32, required: true })) : null,
      h('label', {}, 'Email', h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true })),
      h('label', {}, 'Password', h('input', { type: 'password', name: 'password', autocomplete: isUp ? 'new-password' : 'current-password', minlength: 8, required: true })),
      isUp ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'agree' }), h('span', {}, 'I’m 13 or older and I agree to the ', h('a', { href: ROOT + 'terms/index.html', target: '_blank' }, 'Terms'), ' and ', h('a', { href: ROOT + 'privacy/index.html', target: '_blank' }, 'Privacy Policy'), '.')) : null,
      h('button', { class: 'auth-go', type: 'submit' }, isUp ? 'Create account' : 'Sign in'),
      !isUp ? h('button', { type: 'button', class: 'auth-link', onclick: () => { mode = 'reset'; view(); } }, 'Forgot your password?') : null,
      h('p', { class: 'auth-msg', role: 'alert' }));
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const email = f.email.value.trim(), password = f.password.value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Please enter a valid email.');
      if (password.length < 8) return msg('Your password needs at least 8 characters.');
      if (isUp && !f.name.value.trim()) return msg('Please choose a display name.');
      if (isUp && !f.agree.checked) return msg('Please confirm you’re 13 or older and agree to the terms.');
      const go = f.querySelector('.auth-go'); go.disabled = true;
      try {
        if (isUp) {
          const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: f.name.value.trim() }, emailRedirectTo: location.origin + '/index.html' } });
          if (error) throw error;
          if (data.session) closeAuth(); else msg('Almost done! We sent a confirmation link to ' + email + '. Open it to finish creating your account.', 'ok');
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; closeAuth();
        }
      } catch (err) { msg(friendly(err)); } finally { go.disabled = false; }
    });
    card.append(tabs, gbtn, h('div', { class: 'auth-or' }, 'or'), f);
    setTimeout(() => f.querySelector('input').focus(), 0);
  }
  function openAuth(m) {
    setPop(false); mode = m || 'in';
    if (!modal) { modal = h('div', { class: 'auth-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'authTitle', hidden: true }, h('div', { class: 'auth-card' })); modal.addEventListener('mousedown', e => { if (e.target === modal) closeAuth(); }); document.body.append(modal); }
    view(); modal.hidden = false;
  }
  function closeAuth() { if (modal) modal.hidden = true; }
  window.chunkhubOpenAuth = openAuth;

  // ---------- top-bar button: "Sign In" or the user's picture with a menu ----------
  const nameOf = u => esc((u.user_metadata && (u.user_metadata.display_name || u.user_metadata.full_name || u.user_metadata.name)) || (u.email || '').split('@')[0]);
  const picOf = u => u.user_metadata && (u.user_metadata.custom_avatar || u.user_metadata.avatar_url || u.user_metadata.picture);

  // ---------- custom profile pictures (stored in the "avatars" bucket, one folder per account) ----------
  // The picture is cropped to a square and shrunk to 256 x 256 in the browser before uploading.
  function squareImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
        const m = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - m) / 2, sy = (img.naturalHeight - m) / 2;
        g.imageSmoothingQuality = 'high'; g.drawImage(img, sx, sy, m, m, 0, 0, S, S); URL.revokeObjectURL(url);
        c.toBlob(b => b && b.type === 'image/webp' ? resolve(b) : c.toBlob(j => j ? resolve(j) : reject(new Error('Couldn’t read that picture.')), 'image/jpeg', .88), 'image/webp', .86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t a picture we can read. Try a PNG or JPG.')); };
      img.src = url;
    });
  }
  async function clearAvatars(keep) {
    const { data } = await sb.storage.from('avatars').list(user.id);
    const old = (data || []).map(f => user.id + '/' + f.name).filter(n => n !== keep);
    if (old.length) await sb.storage.from('avatars').remove(old);
  }
  async function uploadAvatar(file) {
    if (!/^image\//.test(file.type)) throw new Error('Please choose a picture file (PNG, JPG, WEBP or GIF).');
    if (file.size > 10 * 1024 * 1024) throw new Error('That picture is over 10 MB. Please choose a smaller one.');
    const blob = await squareImage(file), ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const up = await sb.storage.from('avatars').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (up.error) throw up.error;
    const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { data, error } = await sb.auth.updateUser({ data: { custom_avatar: url } }); if (error) throw error;
    user = data.user; await clearAvatars(path).catch(() => {});
  }
  async function removeAvatar() {
    const { data, error } = await sb.auth.updateUser({ data: { custom_avatar: null } }); if (error) throw error;
    user = data.user; await clearAvatars(null).catch(() => {});
  }
  function avatarInto(el, u) {
    el.innerHTML = '';
    const pic = picOf(u);
    if (pic) { const i = new Image(); i.alt = ''; i.referrerPolicy = 'no-referrer'; i.src = pic; i.onerror = () => { el.innerHTML = ''; el.append(h('span', { class: 'ini' }, nameOf(u).charAt(0).toUpperCase() || '?')); }; el.append(i); }
    else el.append(h('span', { class: 'ini' }, nameOf(u).charAt(0).toUpperCase() || '?'));
  }
  const PERSON = btn.querySelector('.avatar').innerHTML;
  function renderButton() {
    const av = btn.querySelector('.avatar'), lbl = btn.querySelector('.lbl');
    if (user) {
      btn.classList.add('in'); btn.setAttribute('aria-label', 'Account: ' + nameOf(user)); btn.setAttribute('aria-haspopup', 'menu'); avatarInto(av, user);
      pop.className = 'signin-pop menu-in'; pop.setAttribute('role', 'menu'); pop.innerHTML = '';
      pop.append(h('div', { class: 'who' }, h('b', {}, nameOf(user)), h('span', {}, user.email || '')),
        h('a', { class: 'mi', href: ROOT + 'account/index.html', role: 'menuitem' }, 'My account'),
        h('button', { type: 'button', class: 'mi', role: 'menuitem', onclick: async () => { setPop(false); await pushNow(); await sb.auth.signOut(); } }, 'Sign out'));
    } else {
      btn.classList.remove('in'); btn.removeAttribute('aria-label'); btn.setAttribute('aria-haspopup', 'dialog'); av.innerHTML = PERSON; lbl.textContent = 'Sign In';
      pop.className = 'signin-pop'; pop.hidden = true;
    }
  }


  // ---------- advancement ids (as the game saves them) -> names used on the checklist ----------
  const ADV_IDS = {
    'story/root': 'Minecraft', 'story/mine_stone': 'Stone Age', 'story/upgrade_tools': 'Getting an Upgrade', 'story/smelt_iron': 'Acquire Hardware', 'story/obtain_armor': 'Suit Up', 'story/lava_bucket': 'Hot Stuff', 'story/iron_tools': "Isn't It Iron Pick", 'story/deflect_arrow': 'Not Today, Thank You', 'story/form_obsidian': 'Ice Bucket Challenge', 'story/mine_diamond': 'Diamonds!', 'story/enter_the_nether': 'We Need to Go Deeper', 'story/shiny_gear': 'Cover Me with Diamonds', 'story/enchant_item': 'Enchanter', 'story/cure_zombie_villager': 'Zombie Doctor', 'story/follow_ender_eye': 'Eye Spy', 'story/enter_the_end': 'The End?',
    'nether/root': 'Nether', 'nether/return_to_sender': 'Return to Sender', 'nether/find_bastion': 'Those Were the Days', 'nether/obtain_ancient_debris': 'Hidden in the Depths', 'nether/fast_travel': 'Subspace Bubble', 'nether/find_fortress': 'A Terrible Fortress', 'nether/obtain_crying_obsidian': 'Who is Cutting Onions?', 'nether/distract_piglin': 'Oh Shiny', 'nether/ride_strider': 'This Boat Has Legs', 'nether/uneasy_alliance': 'Uneasy Alliance', 'nether/loot_bastion': 'War Pigs', 'adventure/use_lodestone': 'Country Lode, Take Me Home', 'nether/netherite_armor': 'Cover Me in Debris', 'nether/get_wither_skull': 'Spooky Scary Skeleton', 'nether/obtain_blaze_rod': 'Into Fire', 'nether/charge_respawn_anchor': 'Not Quite "Nine" Lives', 'nether/ride_strider_in_overworld_lava': 'Feels Like Home', 'nether/explore_nether': 'Hot Tourist Destinations', 'nether/summon_wither': 'Withering Heights', 'nether/brew_potion': 'Local Brewery', 'nether/create_beacon': 'Bring Home the Beacon', 'nether/all_potions': 'A Furious Cocktail', 'nether/create_full_beacon': 'Beaconator', 'nether/all_effects': 'How Did We Get Here?',
    'end/root': 'The End', 'end/kill_dragon': 'Free the End', 'end/dragon_egg': 'The Next Generation', 'end/enter_end_gateway': 'Remote Getaway', 'end/respawn_dragon': 'The End... Again...', 'end/dragon_breath': 'You Need a Mint', 'end/find_end_city': 'The City at the End of the Game', 'end/elytra': "Sky's the Limit", 'end/levitate': 'Great View From Up Here',
    'adventure/root': 'Adventure', 'adventure/voluntary_exile': 'Voluntary Exile', 'adventure/spyglass_at_parrot': 'Is It a Bird?', 'adventure/kill_a_mob': 'Monster Hunter', 'adventure/read_power_of_chiseled_bookshelf': 'The Power of Books', 'adventure/trade': 'What a Deal!', 'adventure/trim_with_any_armor_pattern': 'Crafting a New Look', 'adventure/honey_block_slide': 'Sticky Situation', 'adventure/ol_betsy': "Ol' Betsy", 'adventure/lightning_rod_with_villager_no_fire': 'Surge Protector', 'adventure/fall_from_world_height': 'Caves & Cliffs', 'adventure/salvage_sherd': 'Respecting the Remnants', 'adventure/avoid_vibration': 'Sneak 100', 'adventure/sleep_in_bed': 'Sweet Dreams', 'adventure/hero_of_the_village': 'Hero of the Village', 'adventure/spyglass_at_ghast': 'Is It a Balloon?', 'adventure/throw_trident': 'A Throwaway Joke', 'adventure/shoot_arrow': 'Take Aim', 'adventure/kill_all_mobs': 'Monsters Hunted', 'adventure/totem_of_undying': 'Postmortal', 'adventure/summon_iron_golem': 'Hired Help', 'adventure/trade_at_world_height': 'Star Trader', 'adventure/trim_with_all_exclusive_armor_patterns': 'Smithing with Style', 'adventure/two_birds_one_arrow': 'Two Birds, One Arrow', 'adventure/whos_the_pillager_now': "Who's the Pillager Now?", 'adventure/arbalistic': 'Arbalistic', 'adventure/craft_decorated_pot_using_only_sherds': 'Careful Restoration', 'adventure/adventuring_time': 'Adventuring Time', 'adventure/play_jukebox_in_meadows': 'Sound of Music', 'adventure/walk_on_powder_snow_with_leather_boots': 'Light as a Rabbit', 'adventure/spyglass_at_dragon': 'Is It a Plane?', 'adventure/very_very_frightening': 'Very Very Frightening', 'adventure/sniper_duel': 'Sniper Duel', 'adventure/bullseye': 'Bullseye', 'adventure/kill_mob_near_sculk_catalyst': 'It Spreads', 'adventure/minecraft_trials_edition': 'Minecraft: Trial(s) Edition', 'adventure/under_lock_and_key': 'Under Lock and Key', 'adventure/revaulting': 'Revaulting', 'adventure/blowback': 'Blowback', 'adventure/who_needs_rockets': 'Who Needs Rockets', 'adventure/crafters_crafting_crafters': 'Crafters Crafting Crafters', 'adventure/lighten_up': 'Lighten Up', 'adventure/overoverkill': 'Over-Overkill', 'adventure/heart_transplanter': 'Heart Transplanter', 'adventure/spear_many_mobs': 'Mob Kabob',
    'husbandry/root': 'Husbandry', 'husbandry/safely_harvest_honey': 'Bee Our Guest', 'husbandry/breed_an_animal': 'The Parrots and the Bats', 'husbandry/ride_a_boat_with_a_goat': 'Whatever Floats Your Goat!', 'husbandry/tame_an_animal': 'Best Friends Forever', 'husbandry/make_a_sign_glow': 'Glow and Behold!', 'husbandry/fishy_business': 'Fishy Business', 'husbandry/silk_touch_nest': 'Total Beelocation', 'husbandry/tadpole_in_a_bucket': 'Bukkit Bukkit', 'husbandry/plant_seed': 'A Seedy Place', 'husbandry/wax_on': 'Wax On', 'husbandry/tactical_fishing': 'Tactical Fishing', 'husbandry/leash_all_frog_variants': 'When the Squad Hops into Town', 'husbandry/wax_off': 'Wax Off', 'husbandry/axolotl_in_a_bucket': 'The Cutest Predator', 'husbandry/froglights': 'With Our Powers Combined!', 'husbandry/kill_axolotl_target': 'The Healing Power of Friendship!', 'husbandry/brush_armadillo': "Isn't It Scute?", 'husbandry/remove_wolf_armor': 'Shear Brilliance', 'husbandry/repair_wolf_armor': 'Good as New', 'husbandry/feed_snifflet': 'Little Sniffs', 'husbandry/plant_any_sniffer_seed': 'Planting the Past', 'husbandry/obtain_sniffer_egg': 'Smells Interesting', 'husbandry/allay_deliver_item_to_player': "You've Got a Friend in Me", 'husbandry/allay_deliver_cake_to_note_block': 'Birthday Song', 'husbandry/bred_all_animals': 'Two by Two', 'husbandry/complete_catalogue': 'A Complete Catalogue', 'husbandry/balanced_diet': 'A Balanced Diet', 'husbandry/obtain_netherite_hoe': 'Serious Dedication', 'husbandry/whole_pack': 'The Whole Pack', 'husbandry/place_dried_ghast_in_water': 'Stay Hydrated!', 'husbandry/sulfur_cube_absorb_tnt': 'Uh Oh'
  };
  const BY_TAIL = {}; for (const [p, n] of Object.entries(ADV_IDS)) { const t = p.split('/').pop(); if (t !== 'root') BY_TAIL[t] = n; }
  // advancements whose exact id we haven't confirmed yet: matched by keywords in their id
  const GUESS = [[/^husbandry\/.*(sulfur|tnt|explosive)/, 'Uh Oh']];
  const nameForPath = path => ADV_IDS[path] || BY_TAIL[path.split('/').pop()] || (GUESS.find(([re]) => re.test(path)) || [])[1] || null;
  const prettyId = id => id.replace(/^minecraft:/, '').split('/').pop().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  // names of the advancements done in a game advancements file
  function doneAdvancements(file) {
    const out = [];
    for (const [id, v] of Object.entries(file || {})) {
      if (!v || typeof v !== 'object' || !v.done || id.includes(':recipes/')) continue;
      const path = id.replace(/^minecraft:/, '');
      out.push({ id, path, name: nameForPath(path) || prettyId(id), known: !!nameForPath(path) });
    }
    return out;
  }
  window.chunkhubAdvancements = { ADV_IDS, doneAdvancements, prettyId, nameForPath };
  // ticks from linked worlds go onto the Advancements checklist
  const normal = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  async function mergeWorldAdvancements() {
    const { data, error } = await sb.from('mc_worlds').select('advancements');
    if (error || !data || !data.length) return false;
    let done = []; try { done = JSON.parse(localStorage.getItem('adv.done') || '[]') || []; } catch {}
    const have = new Set(done.map(normal)), before = done.length;
    for (const w of data) for (const a of doneAdvancements(w.advancements)) if (a.known && !have.has(normal(a.name))) { have.add(normal(a.name)); done.push(a.name); }
    if (done.length === before) return false;
    store.set('adv.done', JSON.stringify(done));
    return true;
  }

  // ---------- checklist progress sync ----------
  // Progress is kept in this browser (keys starting adv. and col.) and copied to the account.
  // When signing in on a new device, both sides are merged: anything ticked anywhere stays ticked.
  const PREFIXES = ['adv.', 'col.'];
  function snapshot() { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (PREFIXES.some(p => k.startsWith(p))) { try { o[k] = JSON.parse(localStorage.getItem(k)); } catch {} } } } catch {} return o; }
  function union(a, b) { return [...new Set([...(a || []), ...(b || [])])]; }
  function merge(local, remote) {
    const out = { ...remote, ...local };
    for (const k of Object.keys(out)) {
      const a = local[k], b = remote[k];
      if (Array.isArray(a) && Array.isArray(b)) out[k] = union(a, b);
      else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) { const m = { ...b, ...a }; for (const s of Object.keys(m)) if (Array.isArray(a[s]) || Array.isArray(b[s])) m[s] = union(a[s], b[s]); out[k] = m; }
    }
    return out;
  }
  let lastSent = '', syncing = false;
  async function pushNow() {
    if (!user || syncing) return;
    const snap = snapshot(), s = JSON.stringify(snap); if (s === lastSent) return;
    syncing = true;
    try { const { error } = await sb.from('progress').upsert({ user_id: user.id, data: snap, updated_at: new Date().toISOString() }); if (!error) lastSent = s; } finally { syncing = false; }
  }
  async function pullAndMerge() {
    const { data, error } = await sb.from('progress').select('data').eq('user_id', user.id).maybeSingle();
    if (error) return;
    const worldsChanged = await mergeWorldAdvancements().catch(() => false);
    const local = snapshot(), merged = merge(local, (data && data.data) || {});
    const before = JSON.stringify(local), after = JSON.stringify(merged);
    if (after !== before || worldsChanged) {
      for (const [k, v] of Object.entries(merged)) store.set(k, JSON.stringify(v));
      // pages read progress when they load, so refresh once to show ticks from the account
      if (document.querySelector('#list, #acctPage') && !sessionStorage.getItem('ch.merged')) { try { sessionStorage.setItem('ch.merged', '1'); } catch {} location.reload(); return; }
    }
    await pushNow();
  }
  setInterval(pushNow, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushNow(); });

  // ---------- My Account page ----------
  function renderAccountPage() {
    const host = document.getElementById('acctPage'); if (!host) return;
    host.innerHTML = '';
    if (!user) {
      host.append(h('div', { class: 'panel-box acct' }, h('h2', {}, 'You’re not signed in'), h('p', { class: 'muted' }, 'Sign in or create an account to save your checklist progress and use it on any device.'),
        h('div', {}, h('button', { type: 'button', class: 'btn2 primary', onclick: () => openAuth('in') }, 'Sign in'), ' ', h('button', { type: 'button', class: 'btn2', onclick: () => openAuth('up') }, 'Create account'))));
      return;
    }
    const isGoogle = (user.app_metadata && user.app_metadata.provider) === 'google';
    const av = h('div', { class: 'big-av' }); { const pic = picOf(user); if (pic) { const i = new Image(); i.alt = ''; i.referrerPolicy = 'no-referrer'; i.src = pic; av.append(i); } else av.append(nameOf(user).charAt(0).toUpperCase()); }
    const picNote = h('span', { class: 'note2', 'aria-live': 'polite' });
    const picInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    picInput.addEventListener('change', async () => {
      const f = picInput.files[0]; picInput.value = ''; if (!f) return;
      picNote.textContent = 'Uploading…';
      try { await uploadAvatar(f); renderButton(); renderAccountPage(); } catch (err) { picNote.textContent = friendly(err); }
    });
    const hasCustom = !!(user.user_metadata && user.user_metadata.custom_avatar);
    const picCtl = h('div', { class: 'pic-ctl' }, picInput,
      h('button', { type: 'button', class: 'btn2', onclick: () => picInput.click() }, hasCustom || picOf(user) ? 'Change picture' : 'Add a picture'),
      hasCustom ? h('button', { type: 'button', class: 'btn2', onclick: async () => { picNote.textContent = 'Removing…'; try { await removeAvatar(); renderButton(); renderAccountPage(); } catch (err) { picNote.textContent = friendly(err); } } }, 'Remove') : null,
      picNote);
    const snap = snapshot(), count = k => (Array.isArray(snap[k]) ? snap[k].length : 0);
    const nameForm = h('form', {}, h('label', {}, 'Display name', h('input', { class: 'field', name: 'name', maxlength: 32, value: nameOf(user) })), h('button', { class: 'btn2', type: 'submit' }, 'Save'), h('span', { class: 'note2', 'aria-live': 'polite' }));
    nameForm.addEventListener('submit', async e => { e.preventDefault(); const v = nameForm.name.value.trim(); if (!v) return; const { data, error } = await sb.auth.updateUser({ data: { display_name: v } }); nameForm.querySelector('.note2').textContent = error ? friendly(error) : 'Saved.'; if (data && data.user) { user = data.user; renderButton(); } });
    const pwForm = h('form', {}, h('label', {}, 'New password', h('input', { class: 'field', type: 'password', name: 'pw', minlength: 8, autocomplete: 'new-password' })), h('button', { class: 'btn2', type: 'submit' }, 'Change password'), h('span', { class: 'note2', 'aria-live': 'polite' }));
    pwForm.addEventListener('submit', async e => { e.preventDefault(); const v = pwForm.pw.value; const out = pwForm.querySelector('.note2'); if (v.length < 8) { out.textContent = 'Use at least 8 characters.'; return; } const { error } = await sb.auth.updateUser({ password: v }); out.textContent = error ? friendly(error) : 'Password changed.'; pwForm.pw.value = ''; });
    const del = h('div', { class: 'panel-box acct' }, h('h2', { class: 'danger' }, 'Delete account'), h('p', { class: 'muted' }, 'This permanently deletes your account and the progress saved to it. Progress saved in this browser stays here.'),
      h('form', {}, h('label', {}, 'Type DELETE to confirm', h('input', { class: 'field', name: 'c', autocomplete: 'off' })), h('button', { class: 'btn2', type: 'submit' }, 'Delete my account'), h('span', { class: 'note2', 'aria-live': 'polite' })));
    del.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const f = e.target; if (f.c.value !== 'DELETE') { f.querySelector('.note2').textContent = 'Type DELETE in capitals to confirm.'; return; } await clearAvatars(null).catch(() => {}); const { error } = await sb.rpc('delete_my_account'); if (error) { f.querySelector('.note2').textContent = friendly(error); return; } await sb.auth.signOut(); location.href = ROOT + 'index.html'; });
    host.append(
      h('div', { class: 'panel-box acct' }, h('div', { class: 'prow' }, av, h('div', {}, h('h2', {}, nameOf(user)), h('p', { class: 'muted' }, user.email || ''), h('p', { class: 'muted' }, isGoogle ? 'Signed in with Google' : 'Signed in with email'))),
        picCtl,
        nameForm, isGoogle ? null : pwForm,
        h('div', {}, h('button', { type: 'button', class: 'btn2', onclick: async () => { await pushNow(); await sb.auth.signOut(); } }, 'Sign out'))),
      h('div', { class: 'panel-box acct' }, h('h2', {}, 'Saved progress'), h('p', { class: 'muted' }, 'Ticks are saved to your account automatically and merged when you sign in on another device.'),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Advancements'), h('span', { class: 'v' }, count('adv.done') + ' / 126')),
          h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Blocks'), h('span', { class: 'v' }, count('col.done.blocks') + ' / 937')),
          h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Mobs'), h('span', { class: 'v' }, count('col.done.mobs') + ' / 88')))),
      del);
  }

  // the saved session can hold an old copy of the profile (e.g. a picture changed on another device), so ask the server for the latest
  async function refreshUser() {
    if (!user) return;
    const { data, error } = await sb.auth.getUser();
    if (error || !data || !data.user || !user || data.user.id !== user.id) return;
    const before = JSON.stringify(user.user_metadata || {});
    user = data.user;
    if (JSON.stringify(user.user_metadata || {}) !== before) { renderButton(); renderAccountPage(); }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshUser(); });

  // ---------- react to signing in and out ----------
  sb.auth.onAuthStateChange((event, session) => {
    const was = user && user.id; user = session ? session.user : null;
    renderButton(); renderAccountPage();
    if (event === 'PASSWORD_RECOVERY') openAuth('newpw');
    if (user && user.id !== was) { setTimeout(pullAndMerge, 0); setTimeout(refreshUser, 0); }
    if (!user) { lastSent = ''; try { sessionStorage.removeItem('ch.merged'); } catch {} }
  });
})();
