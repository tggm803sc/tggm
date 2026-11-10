# TGG WORLD — Campaign Script, Acts I–III

**Status:** Writing draft. No lines are recorded, localized, lip-synced or implemented; this is performance text, not a shipped voice-over asset.
**Keyed to:** [`game/world/world-design-v1.json`](../game/world/world-design-v1.json) — every mission section header is a mission `id` from that file. Act I stage ids are the canonical `hq` → `drive-to-studio` → `produce-master` → `deliver-to-vault` → `complete`.
**Companions:** [World Design Bible](TGG-WORLD-DESIGN-BIBLE.md), [12-Screen UI Handoff](TGG-WORLD-12-SCREEN-UI-HANDOFF.md).
**Economy:** no line in this script awards currency. Mission rewards remain display-only sample data until `od-economy` is approved.

---

## 1. Format key and content rules

| Notation | Meaning |
|---|---|
| `### i-01-hq — Keys to the Coupe` | One scene per mission id. Do not reorder; Act I order is canon. |
| `*Location:*` / `*Present:*` | Scene header for level and casting. |
| `**Decks:**` | Spoken line. Delivery note in parentheses where it matters. |
| `*[action]*` | Camera, animation, audio or gameplay direction. Never spoken. |
| `**Getta** *(choice)*` | Player choice. Options are blockquoted with the immediate reaction under each. |
| `RADIO:` | Inline radio cue; full station copy lives in §2. |
| `MISSION COMPLETE:` | State transition and stinger. Rewards are never granted by a UI callback. |

**Content rules.** Broadcast-clean lyrics: no slurs, no sexual content, no real artists, labels, cars or locations. Conflict is non-lethal; the Syndicate uses lawyers, leases and security, not executions. Bars are written to be performable, and are explicitly not final masters — recording, ad-libs, doubles and localisation are later work.

---

## 2. Cast and radio bible

### 2.1 Voices

| Character | Voice and rhythm | Never does |
|---|---|---|
| **Getta** | Short, dry, deflects with jokes; sincere lines land once and hard. | Monologues, explains the theme out loud. |
| **Decks Marlow** | Freight-engineer cadence. Short sentences. Metaphors from shipping, loading, weight. | Says "I'm proud of you"; he says it with a manifest. |
| **Nia Vale** | Producer precision. Counts bars, names problems, then fixes them. Kind bluntness. | Flatters a bad mix. |
| **Sloane Vex** | Controlled, never raises her voice. Conditions and clauses. Calls people "artist". | Threatens violence; she threatens calendars. |
| **Rell Kasai (KAS-9)** | Measured, competitive, respects craft. Calls the player "new" as a fact, not an insult. | Brags about money. |
| **Mother Audra** | Warm gravel, radio cadence, pauses where a record would breathe. | Says "content". |
| **Tack Reyes** | Loud, generous, laughs first. Race metaphors; calls the crew family without irony. | Apologises for winning. |
| **Ovis** | Quiet, transactional, unsettlingly polite. Talks about people as inventory. | Raises his voice. |

**Minor voices (uncredited, generic):** `Host` (cypher MC), `Local` (open-mic opponent), `Vault Clerk`, `Auctioneer`, `Static Order Runner`, `Syndicate Security`, `Announcer`, `Crowd`. These are function voices, not cast members; they must not acquire names in dialogue without being added to world data.

### 2.2 Stations

| Station | Signal | Owner | Identity |
|---|---|---|---|
| **NORTHLINE 88.8** | Community band | Mother Audra / Northline Choir | The city's memory. Sign-off: *"Keep the tape."* |
| **STATIC 8.08** | Pirate relay | Static Order | No DJ name. Distorted idents. Jams other frequencies at will. |
| **THE VAULT NETWORK 101.1** | Licensed commercial | The Vault Syndicate | Smooth, expensive, advertises the auction as civic progress. |
| **SALT KINGS CHANNEL** | CB / shortwave | Salt Kings | Race calls, engine noise, no format. |

### 2.3 Idents and ads

**NORTHLINE 88.8 — top of hour**
> "It's 88.8, Northline. The rain's doing that thing where it thinks it's a snare. The city's still here. Keep the tape."

**NORTHLINE 88.8 — dead air (Act III only)**
> *(no carrier, then, off-mic, close)* "If you can hear this, the city's still here. Keep the tape."

**STATIC 8.08 — ident**
> "This is not a station. This is a warning with a beat. Cordell, your signal is borrowed. We're taking it back, one block at a time."

**THE VAULT NETWORK — ident**
> "The Vault Network. We own the listen."

**Ads (rotate on 88.8 unless noted):**

- **TGG Motors Yard** — "Bring it in running or bring it in pieces. Either way, we'll make it louder."
- **Dead Air Salvage** — *(Ovis, close and dry)* "If it played once, it plays again. Undertow access, ask for the water line."
- **Studio 808** — "Sixteen steps. Five tracks. One truth. Book the desk, not the dream."
- **The Vault** — *(Sloane, warm)* "Release with us. Keep your name. Most of it."
- **Cordell Frequency Authority (Act III)** — "The spectrum belongs to the city. The city belongs to its partners."

### 2.4 District stings (2–4 seconds, no dialogue)

| District | Sting |
|---|---|
| Harbor Row | Foghorn, container clang, rain on corrugated steel |
| 808 Avenue | Storefront shutter, distant 808 kick, neon buzz |
| Vault District | Glass door seal, lobby hum, heels on marble |
| Cypher Plaza | Crowd murmur, mic feedback, one handclap |
| Motors Yard | Dyno pull, air wrench, radio bleeding through a fan |
| Northline | Wind through a tower guy-wire, choir warm-up |
| Salt Flats | Wind with nothing in it, then a single engine |
| The Undertow | Water drip, pump cycle, a radio two tunnels away |

---

## 3. ACT I — *The Sound of the Streets*

### i-01-hq — Keys to the Coupe

*Location:* TGG HQ loading bay, Harbor Row. Pre-dawn rain.
*Present:* Getta, Decks Marlow.

*[A tarp comes off a sports coupe. The paint is clean; the bumper is not.]*

**Decks:** Three days. A tape. One desk. That's the whole campaign.
**Getta:** The whole campaign is a drive and a deadline?
**Decks:** Everything worth doing is a drive and a deadline.

*[He drops the keys into Getta's hand. They are warm from his pocket.]*

**Decks:** She's a coupe. Gearbox has opinions. Clutch holds a grudge. Brake before the gate, not after.
**Getta:** You giving me the car or the debt?
**Decks:** Both. That's how a crew works.

*[The bay door starts to lift. Rain comes in sideways.]*

**Decks:** The Vault doesn't take walk-ins. It takes deliveries. Studio 808 first — Nia's expecting you. Don't get curious on the way. Get to the desk.

**Getta** *(choice)*
> **"Three days is plenty."**
> **Decks:** (deadpan) "Three days is a threat with a hyphen in it."
>
> **"What happens if I'm late?"**
> **Decks:** "Nothing. That's the problem. Nobody notices late."

*[Getta gets in. The engine catches on the second turn, like it was listening.]*

RADIO: NORTHLINE 88.8 top of hour (§2.3), mixed under the engine.

**MISSION COMPLETE:** `hq`. Coupe unlocked for the player. No reward granted.

---

### i-02-drive-to-studio — The 808 Run

*Location:* Harbor Row → 808 Avenue. Rain, dawn traffic.
*Present:* Getta (driving), Decks (phone), Nia Vale (arrival).

*[Radio: Audra is mid-sentence about a lost dog when the signal bends.]*

**Audra (radio):** "—and if you've seen him, he answers to Snare, which is a terrible name for a dog and a great name for a—"

*[A hard static tear. A second voice, pitched down, rides over the top.]*

**Static Order voice (radio):** "This is not a station. This is a warning with a beat. Cordell, your signal is borrowed. We're taking it back, one block at a time."

*[The station returns mid-word, as if nothing happened.]*

**Audra (radio):** "—a great name for a dog. Anyway. 88.8."

*[Phone buzzes. DEcks, caller ID.]*

**Decks (phone):** "You heard that?"
**Getta:** "Heard what? The dog?"
**Decks:** "The interference. Don't get curious. Get to the desk."
**Getta:** "Curiosity's free."
**Decks:** "So is a funeral. Drive."

*[Cut to Studio 808. Nia is at the desk, headphones around her neck, eating something from a carton.]*

**Nia:** You're the Harbor Row delivery.
**Getta:** I'm the Harbor Row delivery.
**Nia:** (listening to the demo) Your low end is a rumor. Your high end is a police report.
**Getta:** So it's got range.
**Nia:** It's got a witness statement. Sit down.

*[She pulls a second chair out with her foot.]*

**Nia:** Studio time is money. Truth is free. Sit down.

**Getta** *(choice)*
> **"I've heard the truth before."**
> **Nia:** "Not about your own snare, you haven't."
>
> **"How bad is it?"**
> **Nia:** "It's fixable. That's the nicest thing I've said all week."

**MISSION COMPLETE:** `drive-to-studio`. Studio session unlocked. No reward granted.

---

### i-03-produce-master — Five Tracks, One Master

*Location:* Studio 808, live room. Mid-morning.
*Present:* Getta, Nia.

*[Nia sets a metronome, then turns it off. The room is very quiet.]*

**Nia:** Sixteen steps. Five tracks. Drums, bass, keys, lead, fx. You don't get to hide behind a hi-hat.
**Getta:** I don't hide. I layer.
**Nia:** Everyone says that until the mix.

*[Getta loads a drum break from the crate. Nia leans in.]*

**Nia:** Where's that kick from?
**Getta:** A record I found in the Undertow. Ovis sold it to me for a mixtape and a lie.
**Nia:** You didn't make that drum. You found it. Finding is a skill. Crediting is a habit. Write down where it came from before it becomes a lawsuit with a melody.
**Getta:** That's the most romantic thing anyone's said to me.

*[The studio line rings. Nia checks the handset, rolls her eyes, puts it on speaker.]*

**Sloane (phone):** Miss Vale's desk. This is Sloane Vex, The Vault. I hear you have a master coming. I'd like to be the first to congratulate you, and the last to lowball you.
**Getta:** That's a lot of verbs.
**Sloane (phone):** It's a lot of budget. I'm in no hurry. That's not a threat, artist. That's a calendar.

*[Click. Nia hangs up with one finger.]*

**Nia:** She does that. It's a technique. Like reverb.

**Getta** *(choice)*
> **"Should I be worried?"**
> **Nia:** "You should be flattered. Then worried. Then back to the mix."
>
> **"She's not wrong about the budget."**
> **Nia:** "She's never wrong about the budget. That's the trick."

*[Hours later. Five tracks filled. Levels balanced. The loop runs clean.]*

**Nia:** Master action's yours. Read it before you press it. If you can't say what's in the mix, you can't defend it.
**Getta:** Drums from the Undertow. Bass from a broke man's keyboard. Keys from Decks's radio. Lead from me. Fx from the rain outside.
**Nia:** That's a record. Press it.

*[Press. The playhead stops. A small, unglamorous chime.]*

**Nia:** Master locked. Hash is on the receipt. Now it's a promise you can prove.

**MISSION COMPLETE:** `produce-master`. Release state `mastered`. No reward granted.

---

### i-04-deliver-to-vault — Hand It to the Vault

*Location:* The Vault District. Lobby, then delivery desk. Rain on glass.
*Present:* Getta, Vault Clerk, Sloane Vex.

*[The lobby is fifty feet of marble and one bored clerk.]*

**Vault Clerk:** Delivery is pending until the desk confirms. Not before. Not because you're talented.
**Getta:** I brought a master and a good attitude.
**Vault Clerk:** One of those goes in the form. Title. BPM. Key. Explicit flag. Cover asset. The desk doesn't care how it feels.

*[Getta hands over the drive. The clerk scans it. A screen turns green, then waits.]*

**Vault Clerk:** Metadata checks. Mix hash checks. It's pending.
**Getta:** How long's pending?
**Vault Clerk:** Until it isn't.

*[Sloane appears at the desk with the ease of someone who owns the floor. She does.]*

**Sloane:** The standard courtesy. Nothing predatory. Yet.
**Getta:** Yet.
**Sloane:** You have a name now. Names are expensive to maintain. The Vault is very good at maintenance.
**Getta:** I'm not looking for a landlord.
**Sloane:** Nobody ever is. And yet.

*[The clerk's screen turns. A soft, final tone.]*

**Vault Clerk:** Confirmed. You're released.

**Getta:** That's the first time that word's been good news.

**Sloane:** Enjoy the hallway, artist. Distribution is long, and the lights are ours.

RADIO: Vault lobby feed plays THE VAULT NETWORK ident (§2.3).

**MISSION COMPLETE:** `deliver-to-vault`. Release state `released` **only after** the desk confirmation event. No reward granted.

---

### i-05-complete — The Sound of the Streets

*Location:* The Vault District → Harbor Row. Night, rain clearing.
*Present:* Getta, Decks, Audra (radio), Rell (radio).

*[Vault lobby. The record is playing on the lobby feed, priced for the room.]*

**Getta:** It sounds different in here.
**Vault Clerk:** It's the marble. Marble flatters everything. It's why we work in it.

*[Phone. Decks. No greeting.]*

**Decks (phone):** Bring the car back with gas in it.

*[Harbor Row. Crew floor. The coupe is parked badly, deliberately. Decks hands Getta a cup of something hot and does not make a speech.]*

**Decks:** Receipt?
**Getta:** Receipt.
**Decks:** (reading it) Delivery confirmed. Release live. Three days.
**Getta:** You said three days was a threat.
**Decks:** It was. You're still here, so it was a bad one.

*[Radio clicks over. Audra, live.]*

**Audra (radio):** Here's a record out of Harbor Row. First release from a crew that hasn't decided what it is yet. I'd say that's the best time to be one.

*[The track plays. Then the static tear. Rell's voice, unhurried, riding the jammed carrier.]*

**Rell (radio):** Nice record. Shame about the frequency.

*[Static. The room goes quiet. Decks turns the radio down one click, not all the way.]*

**Decks:** That's Static Order. They own the tower on 808 and they've decided we're a problem.
**Getta:** Are we?
**Decks:** We're a receipt with a beat. That's worse.

*[Decks slides a folded paper across the table. A flyer for an open mic at Cypher Street Plaza.]*

**Decks:** You've got a record. Now go get a room.

**MISSION COMPLETE:** `complete`. Act II unlocked. Sample reward shown as display-only (`+350 XP / +80 REP / $50,000 CR`, provenance `SAMPLE_UI_AUDIT`); it is **not** granted until the economy is approved.

---

## 4. ACT II — *Frequency Wars*

### ii-01-open-mic — Open Mic at the Plaza

*Location:* Cypher Street Plaza, sunken amphitheater. Night, dry.
*Present:* Getta, Host, Local, Rell (watching).

*[The plaza is full in the way a plaza is full: half of them listening, half of them waiting for someone to fail.]*

**Host:** Open mic rules. Three rounds, eight bars, no repeats, no excuses. Crowd decides. The crowd is wrong sometimes, but it decides.
**Getta:** Put me down.
**Host:** Name?
**Getta:** (a beat) Tru Go Getta.

*[Somewhere in the rim seats, Rell looks up from a phone.]*

**Host:** First round. Local favorite, three blocks deep, never lost at home. You know how it goes.

*[Local steps in. The crowd is already loud for him.]*

**Local:** Been on this block since the plaza was a parking lot / Sold mixtapes out a backpack, now they call it marketing / You got a coupe and a cosign, I got a curfew and a crowd / Every bar you bought, I had to build out loud /
Say my name on a track, and the block might clap / Say it to my face, and we'll see if the block still claps.

*[Crowd: mixed. The Local's people are loudest.]*

**Getta:** Signed my name on a napkin, kept the napkin in my coat / That's the first contract I ever wrote /
City gave me a curb and a curfew, an echo and an errand / Now the curb's got a speaker, and the speaker's got a parent /
They measure buzz in followers, I measure it in footsteps / Count the blocks that learned my name before the name had a hook yet.

*[Crowd: louder. Not unanimous. Better.]*

**Host:** Second round. Same rules. Try not to repeat yourself; that's the whole point of a second round.

**Local:** You got a record out, congrats, that's a nice little window / I got a hundred shows and a shoulder with a dent, though /
You want the plaza's ear? Then earn it in the weather / Records don't mean nothing if you've never held a room together.

**Getta:** Never held a room together? I held this one at hello / You've been holding it for years and it's still an empty echo /
Weather's just a word for what the block already knows / You can't sell the rain, man. You can only get it on your clothes.

*[Crowd: loud, and now on both sides. The Host lets it run a second too long.]*

**Host:** Third round. Deciding round. Make it count, or don't, it's your life.

**Local:** Last bar, last breath, last chance to say something true / You're a name with a nice car and a receipt. Congratulations. Cool. /
I'd rather be the block that never made it and never lied / Than the record that got made and left the block outside.

**Getta:** You never made it and never lied? That's a long way of saying never tried / The block's not a medal, it's a mortgage, and I'm paying mine in rhymes /
You want the truth? The truth is I don't own the coupe, the desk, the tower / I'm renting every minute — that's why I count them by the hour.

*[A pause. Then the crowd, honestly, goes up for the last line. Local nods: it was a good loss.]*

**Local:** (off mic, to Getta) "Don't repeat the last bar. It's too good to repeat."

*[Rell is standing now, at the rim, not clapping. He waits until the noise drops.]*

**Rell:** You count bars like a landlord counts rent. Come back when you own something.

**Getta:** I own the rent.

*[Rell almost smiles. He leaves.]*

**MISSION COMPLETE:** `ii-01-open-mic`. Cypher ladder unlocked. REP awarded only by the server-side match event.

---

### ii-02-static-interference — Static Interference

*Location:* 808 Avenue, storefront row. Morning after rain.
*Present:* Getta, Nia Vale, Static Order Runner.

*[Every storefront radio is dead. The TVs are fine. The phones are fine. Only the radios.]*

**Nia:** Their relay's louder than our license. They're not blocking the signal, they're replacing it.
**Getta:** With what?
**Nia:** With a reminder that we're renting.

*[Nia opens a tablet: a square wave running up a building on the avenue.]*

**Nia:** Rooftop. Transmitter's got a directional array pointed at the whole strip. Find it. Don't touch the gain — if you spike it, the tower takes the hit, not them.
**Getta:** And if they're up there?
**Nia:** They're not fighters. They're neighbours with better equipment and worse manners.

*[Rooftop. Rain tanks, a dish, a runner in a hoodie with a soldering iron.]*

**Static Order Runner:** We're not blocking you. We're charging the air.
**Getta:** Charging who?
**Runner:** Every storefront that plays our signal pays in attention. You've been listening for free for years.
**Getta:** That's a nice speech for a guy holding a soldering iron.
**Runner:** (shrugs) It's a nice tower. Look — you want this fixed, you need a modulator. Ours burned out. Ask Ovis.
**Getta:** The Undertow guy.
**Runner:** The Undertow guy. Tell him the static says hello.

*[The Runner packs up, unhurried, and leaves by the fire escape. Nia on the earpiece.]*

**Nia (earpiece):** Getta. The relay's still up.
**Getta:** It needs a part. I know a guy.
**Nia (earpiece):** Everyone knows a guy. Be careful which guy.

RADIO: STATIC 8.08 ident plays over the avenue as the Runner disappears (§2.3).

**MISSION COMPLETE:** `ii-02-static-interference`. Relay job unlocked. No reward granted.

---

### ii-03-parts-run — Parts Run

*Location:* The Undertow, Dead Air Salvage. Afternoon, no daylight.
*Present:* Getta, Ovis.

*[The tunnel opens into a shop that shouldn't fit in a tunnel. Shelves of dead electronics, a kettle, one chair.]*

**Ovis:** Dead Air Salvage. If it played once, it plays again.
**Getta:** I need a modulator. Static Order says you have one.
**Ovis:** I have two. One works. One has a story.
**Getta:** I'll take the one that works.
**Ovis:** Everybody says that.

*[Ovis sets a small grey box on the counter but keeps one finger on it.]*

**Ovis:** Price is one record I haven't heard. Not a copy. An original. Something only you could make.
**Getta:** That's not a price. That's a commission.
**Ovis:** It's both. I collect things that don't exist yet.

**Getta** *(choice)*
> **"You'll get the first one off the press."**
> **Ovis:** "Press implies paper. I want the sound. Paper's for landlords."
>
> **"How do I know you won't sell it?"**
> **Ovis:** "I will sell it. Eventually. That's what a collection is. But I'll sell it to somebody who listens."

*[Ovis lifts his finger. Getta takes the modulator.]*

**Ovis:** Careful in the flood line. The water remembers the city's mistakes.
**Getta:** Which mistakes?
**Ovis:** The expensive ones.

*[On the way out: a stack of unlabelled crates, sealed in wax, stamped with an old radio-tower crest.]*

**Getta:** What's in the crates?
**Ovis:** Property of nobody. Which is the most dangerous kind of property.

*[A pump alarm. Water starts climbing the drain wall. Getta runs. The crates stay.]*

**MISSION COMPLETE:** `ii-03-parts-run`. Relay parts recovered. Heat event if the player fights instead of running; no reward granted.

---

### ii-04-tune-up — Tune Up

*Location:* TGG Motors Yard. Late afternoon, rain easing.
*Present:* Getta, Decks.

*[The coupe is on the lift. Decks is under it, talking to the chassis.]*

**Decks:** Relay's in. Don't thank me; thank the alternator.
**Getta:** You're under a car in the rain.
**Decks:** I'm under a car in the rain because you drove it through a tunnel with a pump problem. Hand me the small wrench. The small one. The one you're about to hand me wrong.

*[Wrench. Clunk. Decks rolls out.]*

**Decks:** This car's been through two cities and one divorce. It'll survive you.
**Getta:** Whose was it?
**Decks:** (a beat) Somebody who kept things running for other people. Get in. Test loop. If the relay holds at speed, we're done.

*[Test loop. The coupe pulls clean. Decks rides passenger with one hand on the door.]*

**Decks:** Freight taught me one thing. Everything heavy wants to move. Your job is to decide where.
**Getta:** That's the whole philosophy?
**Decks:** That's the whole job. Everything else is paperwork.

*[Radio, bleeding through the Yard's PA: an ad for the Salt Flats Invitational, Tack Reyes shouting over an engine.]*

**Tack (radio ad):** THREE RACES. WET SALT. PINK SLIPS ONLY. NO PAPER, NO LAWYERS, NO EXCUSES. IF YOU'RE SCARED, STAY HOME AND BE SCARED THERE.

**Getta:** He sounds reasonable.
**Decks:** He sounds expensive. Salt Flats has one rule: don't win ugly. Second rule: win.

**MISSION COMPLETE:** `ii-04-tune-up`. Build tier 1 and vehicle tune unlocked. No reward granted.

---

### ii-05-crew-call — Crew Call

*Location:* Northline, community radio tower. Sunset, clear.
*Present:* Getta, Mother Audra; Sloane (phone).

*[The tower room is warm. Shelves of tapes, each labelled in the same handwriting, decades of it.]*

**Audra:** Every tape in here is somebody's whole week. Nobody's whole life. That's the deal with archives.
**Getta:** Feels like a whole life.
**Audra:** That's the trick of a shelf. It makes a week look like a life. Sit. You've been running since Harbor Row.

*[Getta sits. Audra puts the kettle on a hotplate.]*

**Audra:** A label is a landlord. A crew is a household. Learn the difference before you sign anything.
**Getta:** Sloane says the same thing, backwards.
**Audra:** Sloane says it backwards because backwards is where the money is.

*[She slides a blank tape label across the table.]*

**Audra:** You want a name for the crew? Write it on the label. Ink doesn't lie as fast as people.

**Getta** *(choice)*
> **"Tru Go Getta."**
> **Audra:** (nods) "That's a household name. Don't let it become a brand."
>
> **"The Receipts."**
> **Audra:** "That's a crew that argues. Good. Arguing is how a household stays honest."
>
> **"Northline Sons."**
> **Audra:** "You're not from Northline. That's all right. Nobody's from anywhere until they stay."

*[The label goes on a tape. Audra writes the date under it, small.]*

**Audra:** First tape of the household. When the tower gets quiet, this is the one I'll play.

*[Phone. Sloane. Getta answers on speaker, Audra listening.]*

**Sloane (phone):** After the final, we should talk. Bring your whole self. We'll only buy part of it.
**Getta:** Which part?
**Sloane (phone):** The part that everyone remembers. The rest is yours to keep.

*[Click. Audra doesn't look up from the kettle.]*

**Audra:** She's good. She made it sound like a haircut.

**MISSION COMPLETE:** `ii-05-crew-call`. Crew creation unlocked. No reward granted.

---

### ii-06-plaza-final — Cypher Street Final

*Location:* Cypher Street Plaza. Night, full house, Sloane in the box seat.
*Present:* Getta, Rell Kasai, Host, Sloane, Crowd.

*[The plaza is louder than the open mic. There are three cameras and one lawyer.]*

**Host:** Final. Three rounds. Eight bars. The plaza decides, and the plaza has decided before.
**Rell:** (to Getta, quietly) "You've got a room now. Rooms are easy. Towers are hard."

*[Round one. Rell steps in. He doesn't rush.]*

**Rell:** Three rounds, three roofs, and the plaza don't lie / You brought a tape to a tower; I brought a tower to a mic /
You lease the crowd, I own the echo / You want the whole city? Then learn what a debt knows.

*[Crowd: loud for Rell. Getta breathes once, then steps.]*

**Getta:** You own the tower, not the sound that's coming out of it / You can sell the air if you want, but the mouth is mine to shout with /
You say I lease the crowd — all right, what's the rent / I paid it in a thousand nights you never spent.

*[Crowd: split, leaning Getta. Round two.]*

**Rell:** Your whole career's a receipt, mine's a deed / You got the city's ear, I got the city's need /
You want a legacy? Buy one from a man with a pen / Or keep a block that'll forget you in ten.

**Getta:** A deed to a tower is a paper in a drawer / I'm the reason anybody remembers what the tower's for /
You talk about need like it's a thing you can hold — / Need's what made the tower, and need don't get sold.

*[Crowd: both sides now, honestly. Sloane closes her folder, watching. Round three.]*

**Rell:** Own your masters, own your static, own the silence in between / Take the whole parade, I'll take the frequency /
You can have the room tonight, the room is yours to lose / But the tower's still the tower when the room forgets the news.

**Getta:** Frequency's a hallway, not a home, not a name / I'll take the block that learned my bars before it learned my face /
You can keep the tower, keep the static, keep the deed — / I'll take the household, and the household don't bleed.

*[A long beat. Then the plaza decides: it is loud for both, and louder for the last line. Host takes the mic.]*

**Host:** We have a verdict, and the verdict is "both of you, get off my stage."

*[Laughter. Rell extends a hand, not as mercy — as a receipt.]*

**Rell:** Either way, you own the room tonight. The room's the only thing nobody can buy.

*[Sloane steps to the stage edge, folder open. The cameras turn.]*

**Sloane:** Artist. The master, in perpetuity, with a marketing budget that would make your neighbourhood unrecognizable. Sign tonight and we start Monday.

**Getta** *(choice — sets `contract-decision`)*
> **"The master stays with the crew."**
> **Sloane:** "Then the budget stays with us. We'll speak at the auction."
>
> **"Send me the paperwork. I'll read every line."**
> **Sloane:** "You'd be the first." *(she almost means it)*

*[Sloane leaves. Rell watches her go, then looks at Getta.]*

**Rell:** You know what an auction is, new? It's a room where the city gets sold by the pound.
**Getta:** Whose city?
**Rell:** Exactly.

RADIO: under the closing crowd, a VAULT NETWORK bulletin announces the Cordell spectrum auction (§2.3).

**MISSION COMPLETE:** `ii-06-plaza-final`. Act III unlocked. Contract decision recorded as a branch flag; no currency granted.

---

## 5. ACT III — *The Getta Coast*

### iii-01-spectrum — Spectrum Auction

*Location:* The Vault District, auction floor. Day, hard light, no rain for once.
*Present:* Getta, Sloane, Audra, Auctioneer, Crowd.

*[A room of chairs, a lectern, and a screen listing frequencies like property. Because they are.]*

**Auctioneer:** Lot fourteen: the community band. A hundred years of rain, two towers, one archive. Bidding opens at civic partnership.

**Sloane:** The Vault Syndicate bids for the community band, and for the silence around it.
**Audra:** (from the back, not standing) You can buy the tower. You can't buy the habit of listening.
**Auctioneer:** (without looking up) The floor recognises the objection as not a bid.

*[Laughter, the nervous kind. Sloane turns to Getta, close enough that the cameras get both of them.]*

**Sloane:** You can still be the artist. Artists don't need frequencies.
**Getta:** They need ears.
**Sloane:** So do landlords.

*[The gavel. The screen turns. Lot fourteen is sold.]*

**Auctioneer:** Sold to The Vault Syndicate, pending frequency-authority approval. The city thanks its partners.

*[Outside. Audra is already smoking, which is a thing she only does at bad news.]*

**Audra:** They'll shut the tower at midnight. You know what a city sounds like at midnight? Nothing.
**Getta:** Then we don't use the tower.
**Audra:** Child, that's not a plan. That's a sentence.
**Getta:** It's a start.

RADIO: THE VAULT NETWORK plays a congratulatory ident; Audra switches it off mid-word (§2.3).

**MISSION COMPLETE:** `iii-01-spectrum`. Spectrum stakes set; tower shutdown timer begins. No reward granted.

---

### iii-02-flats-invitational — Salt Flats Invitational

*Location:* Salt Flats, abandoned airfield. Rain on salt, dusk.
*Present:* Getta, Tack Reyes, Announcer.

*[Everything is grey except the cars. Tack is standing on a crate, because of course he is.]*

**Tack:** THREE RACES. Rain on salt. Pink slips only — no paper, no lawyers.
**Getta:** I'm not putting up the coupe.
**Tack:** Then put up something you're scared to lose.
**Getta:** I've got a crew.
**Tack:** (laughing) Then you've got more than most. First race is the runway. Don't brake at the water tower.
**Getta:** Why would I brake at the water tower?
**Tack:** Because everyone does.

*[Announcer, over a PA that has seen better decades.]*

**Announcer:** Ladies and gentlemen, the salt is wet, the light is gone, and the rules are a rumour. Racers, start your bad decisions.

*[Heat one. Radio chatter between cars.]*

**Tack (radio):** You drive like rent's due, new. I respect it.
**Getta (radio):** You drive like the lease is somebody else's problem.
**Tack (radio):** That's the Salt Kings' whole business model.

*[Heat two. Tack loses the line on the salt road and finds it again.]*

**Tack (radio):** Syndicate offered me sponsorship last month. Told them I already got a family. Then they raised my lease. Funny how that works.
**Getta (radio):** Not funny.
**Tack (radio):** It's a little funny. Rent's always funny when it's not yours.

*[Heat three. Getta wins the last one clean. Tack slides to a stop, jumps out, and laughs at the sky.]*

**Tack:** You drive like rent's due. (offers a hand) Salt Kings channel is yours. Don't say my name wrong on it.
**Getta:** Which name?
**Tack:** The one with the laugh in it.

**MISSION COMPLETE:** `iii-02-flats-invitational`. Salt Kings ally, race ladder unlocked. Vehicle stakes are narrative only; no currency granted.

---

### iii-03-blackout — Blackout Protocol

*Location:* The Undertow → Harbor Row drain. Night, no power.
*Present:* Getta, Ovis, Syndicate Security, Audra (radio, off-mic).

*[The tunnels are black. Somewhere, a pump is failing.]*

**Ovis:** (from the dark, calm) "I sold the tunnel rights. Two years ago. It was rent, not betrayal."
**Getta:** It's a blackout, Ovis.
**Ovis:** "It's a bill. I sell things. It's the only verb I have."

*[A security lamp comes on. Two figures in Syndicate windbreakers, no weapons drawn yet.]*

**Syndicate Security:** Cordell Frequency Authority. This tunnel is now licensed property. Vacate, or be documented.
**Getta:** Documented.
**Security:** (producing a tablet) "That's the spirit."

*[Non-lethal scuffle. The tablet ends up in the water. The lamps go out again.]*

**Ovis:** (lighting a hand lantern) "Pump room's at the end. If the water gets to the archive, the archive goes."
**Getta:** The crates.
**Ovis:** "The crates. Property of nobody. Which means tonight it's property of whoever carries it."

*[Pump room. Getta gets the pump running. Somewhere above, the Harbor Row drain motor engages. The radio on Ovis's belt, dead for an hour, crackles.]*

**Audra (radio, off-mic, close):** "If you can hear this, the city's still here. Keep the tape."

*[Ovis looks at the radio like it insulted him.]*

**Ovis:** "They shut the tower. She's on a backup relay with a battery and a grudge."
**Getta:** You asked for the crates earlier.
**Ovis:** "I did."
**Getta** *(choice)*
> **"The crates stay with the crew."**
> **Ovis:** "Fine. The tunnels are mine either way. That's not a threat. It's a deed."
>
> **"Take one. Not the whole archive."**
> **Ovis:** (quietly pleased) "A negotiator. The city might survive you."

**MISSION COMPLETE:** `iii-03-blackout`. Undertow reopened; tower is on backup relay. No reward granted.

---

### iii-04-one-city — One City, One Mix

*Location:* Northline tower, backup power. Night.
*Present:* Getta, Audra, Nia, Decks, Rell, Tack, Ovis.

*[The tower room is crowded for the first time. Six people, one kettle, a mix desk on a folding table.]*

**Audra:** Before anyone says "plan", know that I have the archive, a microphone older than all of you, and no license after midnight.
**Rell:** I can give you the tower. It's a pirate tower. It's already illegal; illegality is the one license I keep.
**Tack:** I got the Flats channel and a truck with a generator.
**Ovis:** "I got a tunnel and no scruples."
**Nia:** I got the mix.
**Decks:** Then we're a network. Somebody get me a manifest.

*[Decks starts writing on the back of an old shipping docket, instantly in his element.]*

**Nia:** If we do this, we're not just independent. We're unlicensed. That's a fine, and maybe worse.
**Getta:** Independent was the plan.
**Nia:** Independent was the vibe. Unlicensed is a legal category.

**Audra:** Then we do it once, we do it clean, and we put our names on it. A citywide broadcast from five districts, ninety minutes, one mix. If they shut us down, they shut down the whole city's evening.
**Rell:** They will.
**Audra:** I'm counting on it. Nothing unites a street like a landlord.

*[Nia turns to Getta.]*

**Nia:** You need a station ident. Not a slogan. Something a person can answer.

**Getta** *(choice)*
> **"This is 88.8, Cordell. Own your signal."**
> **Rell:** "Militant. I like it. The Authority will like it less."
>
> **"You're listening to Tru Go Getta. We don't own the air. We just breathe it loud."**
> **Tack:** "That's a T-shirt. That's a whole T-shirt."
>
> **"This is the city. Hello, city."**
> **Audra:** (immediately) "That one. Nobody can sue a greeting."

*[Audra writes it on the tape label under the crew name. The kettle clicks off.]*

**Decks:** Manifest's done. Rell takes the 808 relay. Tack takes the Flats transmitter. Ovis keeps the tunnel line open. Nia rides the mix. Audra calls it. I drive.
**Getta:** What do I do?
**Decks:** You make the record worth broadcasting. That's the hard one.

**MISSION COMPLETE:** `iii-04-one-city`. City broadcast unlocked; ident recorded as a branch flag. No reward granted.

---

### iii-05-album — The Getta Coast LP

*Location:* Studio 808. Night, one lamp, five tracks.
*Present:* Getta, Nia, Decks, Sloane.

*[The desk is covered in cups. Nia has not slept and is pretending she has.]*

**Nia:** Five tracks. One sequence. If it doesn't hurt, it's a playlist.
**Getta:** Which one's supposed to hurt?
**Nia:** The one you keep skipping. That's always the one.

*[Getta pulls up a session. It's rough, and it's honest.]*

**Getta:** It's about the coupe.
**Nia:** Everything you write is about the coupe. This one's about the guy who had it before you.
**Getta:** Decks won't tell me.
**Nia:** Then put it in the record and make him listen.

*[Decks comes in with two coffees, sees the session name, and sits down slowly.]*

**Getta:** The car was Emmett's.
**Decks:** (after a moment) "Emmett ran the tower before Audra. Kept the archive in the tunnels because the tower flooded every spring. When the Authority started buying frequencies, he moved the tapes and stopped coming up."
**Getta:** Where is he?
**Decks:** "Two cities up the coast. Still running a station nobody's licensed. Still owes me a favour." (a beat) "The car was the favour."
**Getta:** So I'm driving a favour.
**Decks:** You're driving a debt with good suspension. Finish the record.

*[Sloane appears in the studio doorway, coat perfect, rain still on it.]*

**Sloane:** I'll be brief. Broadcast, and we'll sue the air. Sign, and the air is yours for a decade.
**Nia:** (not looking up) "You're in my room."
**Sloane:** "I'm in everyone's room. It's the business model."

**Getta** *(choice)*
> **"The air's not yours to sell."**
> **Sloane:** "Then you'd better be very good at breathing."
>
> **"I'll take the decade and the receipt."**
> **Sloane:** "Now you sound like a professional." *(she does not look pleased)*

*[Sloane leaves. Nia puts the master chain on the sequence.]*

**Nia:** No clipping. No filler. Credits intact — every sample, every voice, every tunnel.
**Getta:** And if it doesn't chart?
**Nia:** It'll chart. That's not the hard part. The hard part is still being from somewhere after it does.

*[The sequence runs. Nia listens to the whole thing with her eyes closed, then opens them.]*

**Nia:** That's the first honest master to come out of this room since your demo.

**MISSION COMPLETE:** `iii-05-album`. Album mastered; Sonata GT unlock tied to story state, not purchase. No reward granted.

---

### iii-06-finale — Tru Go Getta

*Location:* Cypher Street Plaza → Salt Flats → The Vault District. Night, rain returning.
*Present:* Getta, Rell, Tack, Nia, Decks, Audra, Sloane, Vault Clerk, Crowd.

*[Part one: the plaza. The broadcast is already running. The crowd is not a crowd; it's a city holding its breath.]*

**Rell:** Ten rounds deep and the plaza still standing / You got a name now — hope you know what a name's for /
I built the signal, you built the reason / I'll take the tower down if you take the season.

**Getta:** Name's a door, not a house; I'll leave it open / Let the block walk through it, let the Syndicate phone it /
Season's just weather with a calendar attached / You sold the air, I kept the match.

*[Crowd up. Rell nods once and steps back, out of the light, which is the highest compliment he has.]*

**Rell:** (off mic) "Go finish it. I'll keep the frequency warm."

*[Part two: the salt road, rain, one relay handoff. Tack pulls alongside, not to race, to pace.]*

**Tack (radio):** Left at the water tower. Don't brake at the water tower.
**Getta (radio):** You said that last time.
**Tack (radio):** And you didn't listen, and you won. Don't make it a habit.

*[The relay box changes hands at 140. Nia's voice on the mix, steady.]*

**Nia (radio):** Signal's clean. All five districts. Ninety minutes and counting. Whatever you're doing, do it in the next four.

*[Part three: the Vault lobby, marble, rain, a clerk who has never been busier.]*

**Vault Clerk:** Delivery. Title. BPM. Key. Explicit flag. Cover asset. Credits list.
**Sloane:** (from the mezzanine) "This is vandalism with distribution."
**Getta:** It's a record. You'd know if you listened.
**Sloane:** "I listened. That's why I'm suing."

*[Clerk scans. The screen waits. Then:]*

**Vault Clerk:** Metadata checks. Mix hash checks. Credits... intact.
**Getta:** Say the word.
**Vault Clerk:** (a pause, then, almost human) "Released."

*[The city hears it. All five districts, all at once, for one verse before the rain and the relays and the phones all agree on the same thing.]*

**MISSION COMPLETE:** `iii-06-finale`. Ending branch resolves on `contract-decision`; broadcast completes. No reward granted.

---

## 6. Endings

Both endings keep the player in Cordell. Neither is a punishment. The difference is who owns the master.

### 6.1 Ending A — Signed (`contract-decision: signed`)

*[The Vault Network plays the record every hour, with an ad every eight minutes.]*

**Sloane:** "You have a name, a budget and a calendar. The master is ours. That's the trade. You were awake for it."
**Decks:** "The car's yours. The rest is paperwork."
**Audra:** (last broadcast of the season) "You got everything, child. Keep the tape anyway."

**Radio epilogue:** VAULT NETWORK, clean and loud. Then one jam — STATIC 8.08, three seconds of static, and Rell's voice: *"I'll keep the frequency warm."* Then the carrier returns to the Vault.

### 6.2 Ending B — Independent (`contract-decision: declined`)

*[The broadcast runs all ninety minutes. The fine arrives on Monday. The tower stays on, via five relays and one grudge.]*

**Audra:** "The archive got bigger today."
**Decks:** "Receipt's in your name. All of it."
**Sloane:** (on the courthouse steps) "We'll appeal. We can afford to wait. Can you?"
**Getta:** "We've got a household. We've got time."

**Radio epilogue:** NORTHLINE 88.8, back at full power. Audra reads the fine on air, item by item, like a shipping manifest, and then plays the album uninterrupted.

### 6.3 Shared sequel hook

*[After both endings, late night, the radio scans past Cordell.]*

**Unknown station (radio):** "...you're listening to 41.9, two cities up the coast. We caught a broadcast out of Cordell last night. If whoever's running that relay is listening — the Coast is bigger than one city. Keep the tape."

*[Static. The dial stops.]*

---

## 7. Coverage

| Mission id | Scene | Act | Radio cue |
|---|---|---|---|
| `i-01-hq` | §3 | I | 88.8 top of hour |
| `i-02-drive-to-studio` | §3 | I | Static Order jam |
| `i-03-produce-master` | §3 | I | Sloane call |
| `i-04-deliver-to-vault` | §3 | I | Vault lobby feed |
| `i-05-complete` | §3 | I | 88.8 dedication + Rell jam |
| `ii-01-open-mic` | §4 | II | — |
| `ii-02-static-interference` | §4 | II | Static 8.08 ident |
| `ii-03-parts-run` | §4 | II | — (no signal underground) |
| `ii-04-tune-up` | §4 | II | Salt Flats ad |
| `ii-05-crew-call` | §4 | II | — |
| `ii-06-plaza-final` | §4 | II | Vault bulletin |
| `iii-01-spectrum` | §5 | III | Vault ident |
| `iii-02-flats-invitational` | §5 | III | Salt Kings channel |
| `iii-03-blackout` | §5 | III | Audra off-mic |
| `iii-04-one-city` | §5 | III | — |
| `iii-05-album` | §5 | III | — |
| `iii-06-finale` | §5 | III | Broadcast + epilogue |

## 8. Open threads and honest state

- **Not recorded.** No VO, no lip-sync, no localized strings. This is a writing draft.
- **No mission scripting.** Lines are keyed to ids but not wired to triggers; pickups, triggers and camera work are unimplemented.
- **Bars are drafts.** Cypher lyrics are performance text, not mastered audio; ad-libs, doubles and crowd responses are unrecorded.
- **Branch flags only.** `contract-decision` and the station-ident choice are narrative flags; they do not award currency and have no save field yet (`od-save-schema-v2`).
- **Open threads to resolve in a later pass:** Emmett's station up the coast (sequel hook); the crates' ownership; whether Ovis is forgiven; the fine from Ending B; the Authority's next auction.
- **Not canon until approved:** `od-ending-canon` is unresolved, so both endings are drafted equally and neither is declared canonical.
