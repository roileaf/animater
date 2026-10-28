// Reviewed against complete pinned effect descriptions and their linked spell,
// feat/equipment providers. These are field compositions, not status markers.
// Aliases describe one underlying ability's emitter and recipient documents.
import {assetGeometry} from './spell-asset-selection.mjs';
import {colorAffinity} from './color-affinity.mjs';
import {variantFiles} from './asset-databases.mjs';

const colors={gold:['yellow','#ffe2a0'],silver:['white','#dbe9ff'],ruby:['red','#c95370'],violet:['purple','#b28ce8'],green:['green','#94dca8'],amber:['orange','#ffb978'],blue:['blue','#9ccff9'],pink:['pink','#eeaddd'],grey:['grey','#b7bdc8'],black:['black','#646577'],teal:['blueteal','#8fded7']};
const layer=(label,root,color='blue',options={})=>({label,roots:Array.isArray(root)?root:[root],palette:colors[color],opacity:.9,below:true,playbackRate:.8,...options});
const glyph=(school,color='blue',label=`${school[0].toUpperCase()+school.slice(1)} field`)=>layer(label,`magic_signs.circle.02.${school}.loop`,color);
// Aura003's styles are motifs, not shapes: 1 hearts, 2 screaming spirits, 3 digital blocks, 4 flame-like
// tendrils, 5 clean ripples. Pick by meaning; skulls on Bless or hearts on a marshal's aura read wrong.
const FLOW_MOTIFS={heart:1,spirit:2,tech:3,tendril:4,ripple:5};
const flow=(direction,motif='ripple',color='blue',label,part='combined')=>{
 const style=FLOW_MOTIFS[motif];if(!style)throw Error(`Unknown flow motif: ${motif}`);
 return layer(label??`${direction==='inward'?'Gathering':'Radiating'} energy`,`template_circle.aura.03.${direction}.00${style}.loop.${part}`,color);
};
const shimmer=(direction='outward',label='Refractive boundary')=>layer(label,`template_circle.aura.04.${direction}.001.loop.combined`,'silver',{opacity:.85});
const orbit=(material,color='blue',direction='orbit',label)=>layer(label??`${material[0].toUpperCase()+material.slice(1)} ${direction}`,`aura_themed.01.${direction}.loop.${material}.01`,color);
const stars=(points=4,color='gold',label='Light glints')=>layer(label,`twinkling_stars.points0${points}`,color);
// No smoke or fume footage in auras (it buries the tokens inside them): a "haze" is coloured drifting motes.
const smoke=(color='grey',label='Suspended haze')=>layer(label,'particles.swirl',color,{below:false,opacity:.7});
const bubbles=(style=1,color='blue',label='Enclosing bubbles')=>layer(label,`bubble.00${style}.001.loop`,color);
const leaves=(style=1,label='Living leaves')=>layer(label,`swirling_leaves.loop.0${style}`,'green');
// Only continuous footage: energy_field.02 and radar pings play once and vanish, flames.04 rises off-centre above the token.
const energy=(style=1,color='blue',label='Energy veil')=>layer(label,'energy_field.01',color);
const wind=(style=1,label='Wind streaks')=>layer(label,`wind_lines.01.0${style}.white`,'silver');
const whirl=(color='blue',label='Whirling current')=>layer(label,'template_circle.whirl.loop',color);
const vortex=(color='violet',label='Inward vortex')=>layer(label,'template_circle.vortex.loop',color);
const fire=(label='Flame field')=>layer(label,'fire_ring.500px','amber');
const embers=(label='Floating embers')=>layer(label,'particles.swirl','amber');
const radar=(shape='round',label='Awareness sweep')=>layer(label,{round:'template_circle.radar.loop.800px.001',square:'template_circle.radar.loop.002.800px',triangle:'template_circle.radar.loop.001.800px'}[shape],'teal');
const plan=(rationale,...layers)=>({rationale,layers});

const plans={
 'Angelic Halo':plan('A golden halo field and soft glints mark enhanced healing from later Heal spells; no recurring healing impacts.',flow('outward','ripple','gold','Halo radiance'),stars(4,'gold','Angelic glints')),
 "Demon's Knot":plan('Subtle inward ruby threads symbolize the necklace’s thirty-foot temptation and Will penalty. No flames or repeated damage.',flow('inward','tendril','ruby','Ruby temptation'),glyph('enchantment','ruby','Temptation sigil')),
 'Elysian Dew':plan('An outward ring of living growth and green motes represent intensified natural colors and vitality across the aura. Native bonuses remain separate from healing.',orbit('nature','green','outward','Dew-fed growth'),layer('Colorful vitality motes','particles.swirl','green',{opacity:.8})),
 'Form a Flock':plan('A circling flock and wind represent the dragonets surrounding the bearer. JB2A butterflies are a symbolic flying-creature substitute.',layer('Symbolic dragonet flock','butterflies.loop.01','amber',{below:false}),whirl('amber','Flock currents')),
 // The one aura that is literally smoke: a looping smoke template filling the radius, drawn under the tokens so it
 // marks the cloak without burying anyone (the black-tinted energy flow read as a demonic aura).
 'Fuming Cloak':plan('Nightmare’s Lament continually vents thick black smoke in a 15-foot aura: a low black smoke cloud filling the radius under the tokens, with drifting dark motes. Native concealment and sickened application remain PF2e-controlled.',layer('Thick black smoke','template_circle.smoke.001.loop','black',{opacity:.7}),smoke('black','Drifting smoke motes')),
 'Manifest Will':plan('Neutral refraction and formulas mark the magical field when its tradition is unknown. Native tradition selects a matching field when available.',shimmer('outward','Unspecified magical presence'),glyph('transmutation','silver','Manifest formulas')),
 'Protective Wards':plan('A ring of protective glyphs and a refractive perimeter represent the expanding ward. Radius follows the native prepared aura.',glyph('abjuration','blue','Protective glyph ring'),shimmer('outward','Expanding ward boundary')),
 "Protector's Sphere":plan('An enclosing shield shell and energy lining represent the protective sphere, distinct from a ground ring of ward glyphs.',layer('Protective sphere shell','shield.01.loop','blue'),shimmer('outward','Sphere boundary')),
 'Righteous Call':plan('Radiating divine energy and evocation glyphs symbolize holy empowerment of later allied Strikes; no ongoing attack impacts.',flow('outward','ripple','gold','Righteous radiance'),glyph('evocation','gold','Holy strike empowerment')),
 'Searing Blade (Greater)':plan('Flame and rotating ember streams surround the weapon’s fiery emanation, without repeatedly dealing damage.',fire('Searing emanation'),embers('Blade embers')),
 'Shining Symbol':plan('Bright gold glints and revelation glyphs represent the luminous amulet’s spirit-revealing field.',stars(5,'gold','Symbol radiance'),glyph('divination','gold','Revealing field')),
 'Spiral of Horrors':plan('A whirling spectral field and inward occult runes symbolize the circling shades. Fear remains controlled by native saves.',whirl('violet','Whirling shades'),glyph('necromancy','violet','Horror spiral')),
 'Wrathful Presence':plan('Outward crimson pressure and dark wisps symbolize wrathful combat presence; no automatic fear or attacks.',flow('outward','tendril','ruby','Wrath pressure'),smoke('violet','Wrathful wisps')),
 'Area Armor':plan('A steel-colored abjuration perimeter and inward metal protection symbolize shelter from adjacent heavy armor. No attack animation.',glyph('abjuration','grey','Armored shelter'),orbit('metal','grey','inward','Steel shelter')),
 'Ascended Celestial Nimbus':plan('A luminous celestial nimbus protects against fear; the visual is light, not a frightened marker.',flow('outward','ripple','gold','Celestial nimbus'),stars(8,'silver','Celestial light')),
 'Aura of Confidence':plan('Warm inward light and enchantment glyphs symbolize mental protection and confidence, not mind control.',flow('inward','ripple','gold','Steady confidence'),glyph('enchantment','gold','Mental ward')),
 'Aura of Despair':plan('A dark contracting field and ominous occult circle symbolize despair and vulnerability to fear.',flow('inward','spirit','violet','Contracting despair'),glyph('necromancy','ruby','Despair circle')),
 'Aura of Determination':plan('Interwoven inward refraction and protective formulas symbolize resistance to mental influence and transformation.',shimmer('inward','Determination weave'),glyph('abjuration','violet','Resolve ward')),
 'Aura of Faith':plan('A silver divine circle and outward presence represent faith without assuming the bearer’s holy or unholy choice.',glyph('conjuration','silver','Divine presence circle'),flow('outward','ripple','silver','Faith radiance')),
 'Aura of Life':plan('Inward vitality-colored protection and abjuration glyphs represent defense against void energy, not repeated healing.',flow('inward','ripple','green','Vitality protection'),glyph('abjuration','green','Anti-void ward')),
 'Aura of Righteousness':plan('Golden containment runes and an inward boundary symbolize protection against unholy influence and teleportation.',layer('Righteous containment runes','magic_signs.rune.abjuration.loop','gold'),shimmer('inward','Teleportation ward boundary')),
 'Banner of the Restful':plan('A mellow peach field and quiet watch glyph represent comfort during watch; no sleep effect is implied.',flow('outward','ripple','pink','Restful banner field','part01'),glyph('divination','amber','Watchful comfort')),
 'Blazing Banner':plan('A red-orange energy weave and sparks echo the banner’s flame-like fabric and later critical-hit empowerment.',flow('inward','tendril','ruby','Blazing fabric weave','part01'),embers('Banner sparks')),
 'Celestial Yaoguai Might':plan('Celestial light and divine formulas represent the celestial-only aura branch of Yaoguai Might. Other branches do not inherit this field.',stars(6,'gold','Celestial brilliance'),glyph('conjuration','gold','Celestial might field')),
 "Commander's Banner":plan('A brass outward signal and steady resolve circle symbolically mark leadership and protection against fear.',flow('outward','ripple','amber','Command signal'),glyph('enchantment','silver','Steady resolve')),
 'Creeping Ashes':plan('Low grey ash and an inward ground current represent the ash cloud and difficult terrain. No flames until the separate collapse ability.',layer('Drifting ash motes','particles.swirl','grey',{opacity:.75}),flow('inward','tendril','grey','Ash-covered ground')),
 'Curse Maelstrom State':plan('An inward violet vortex and occult formula circle symbolize the storm of misfortune, without inventing lightning damage.',vortex('violet','Misfortune maelstrom'),glyph('illusion','violet','Misfortune formulas')),
 'Curse of Engulfing Flames':plan('An engulfing flame perimeter and inward crimson pressure depict the active major-curse aura. Native predicates control its existence.',fire('Engulfing flame perimeter'),flow('inward','tendril','ruby','Engulfing curse pressure')),
 'Curse of the Perpetual Storm':plan('Whirling currents and dense pale haze represent wind and storm clouds. No automatic lightning strikes or assumed curse tier.',whirl('grey','Storm currents'),smoke('silver','Storm-cloud veil')),
 'Dawnfire Beacon (Major)':plan('Sunlight glints and a radiating beacon field represent the daylight banner. Sunlight is not an ongoing flame attack.',stars(9,'gold','Beacon sunlight'),flow('outward','ripple','gold','Dawn beacon reach')),
 'Desolation Locket - Weapon':plan('A dark inward field and fading-color glints symbolize hopelessness around the weapon. Separate activations do not replay.',flow('inward','spirit','black','Desolation field'),stars(4,'violet','Dimming hope')),
 "Devrin's Cunning Stance":plan('Angular awareness pings and illusion formulas symbolically mark cunning and later feints, without playing an attack.',radar('triangle','Cunning awareness'),glyph('illusion','amber','Deceptive tactics')),
 'Divine Health':plan('A clean inward refractive field and green glints symbolize disease and poison protection, not toxic fumes.',shimmer('inward','Clean protective boundary'),stars(5,'green','Health ward glints')),
 'Dread Marshal Stance':plan('Crimson combat pressure and an evocation rune symbolize damage empowerment; allies are not shown as frightened.',flow('outward','spirit','ruby','Dread combat pressure'),layer('Marshal combat rune','magic_signs.rune.evocation.loop','ruby')),
 'Ectoplasmic Aura':plan('Pale vapor and a spectral energy veil depict thick ectoplasm, rather than a ghost impact or explosion.',smoke('teal','Ectoplasmic vapor'),energy(1,'silver','Spectral energy veil')),
 'Enlightened Presence':plan('An inward gold field and divination circle symbolize poised resolve and insight.',flow('inward','ripple','gold','Enlightened resolve'),glyph('divination','silver','Insight circle')),
 'Forge Warden':plan('Metal protection and warm forge glints represent fire resistance around the shield. Shield Block’s separate fiery response is not looped.',orbit('metal','grey','inward','Forge protection'),stars(6,'amber','Forge glints')),
 'Furious Possession':plan('Outward red energy and spirit vapor symbolize rage shared through possession; tokens are not moved continuously.',flow('outward','spirit','ruby','Rage pressure'),smoke('ruby','Possessing spirit haze')),
 'Ghosts in the Storm':plan('Grey cloud plumes and wind streaks depict the storm aura; later movement-triggered electricity is not played continuously.',vortex('grey','Ghost-storm currents'),wind(2,'Storm wind streaks')),
 'Glorious Banner':plan('Golden awareness pings and brilliant stars symbolize the larger commanding banner field and its resolve pressure.',radar('round','Glorious command reach'),stars(8,'gold','Banner brilliance')),
 "Gruhastha's Inspiration":plan('Wisdom glyphs and an inward luminous field symbolize knowledge and resolve, without implying an attack or healing.',glyph('divination','gold','Wisdom glyphs'),flow('inward','ripple','gold','Inspired insight','part01')),
 'Hexwise Banner':plan('Green and purple interleaved magical circles echo the banner’s woven colors and protection against spells.',glyph('abjuration','green','Green protective weave'),glyph('transmutation','violet','Purple counterspell weave')),
 "Hunter's Onslaught":plan('Hunting awareness marks and outward combat pressure symbolically mark coordination against prey; no healing or continuous weapon hits.',radar('square','Hunting awareness'),flow('outward','tendril','amber','Onslaught readiness')),
 'Inspiring Marshal Stance':plan('Warm outward inspiration and bright glints symbolize attack accuracy and mental resolve, distinct from Dread Marshal’s combat field.',flow('outward','ripple','gold','Inspiring presence'),stars(5,'gold','Marshal encouragement')),
 'Kindle Inner Flames':plan('Faint glowing embers and warm outward threads depict kindled potential. No wall of fire or continuously burning creatures.',embers('Kindled embers'),flow('outward','ripple','amber','Inner warmth')),
 'Kinetic Aura':plan('Neutral refractive circulation and a gate circle symbolize kinetic presence when its element is unspecified. Active stances supply their own fields.',shimmer('outward','Unspecified kinetic field'),glyph('conjuration','silver','Kinetic gate')),
 "Knave's Standard":plan('A black-red outward weave and deceptive formulas echo the changing banner fabric and opportunistic precision.',flow('outward','tendril','black','Knave banner weave'),glyph('illusion','ruby','Opportunistic field')),
 'Life Burn Aura':plan('Force-energy lining and an inward refractive perimeter represent the native force aura. “Burn” does not make this a fire effect.',energy(2,'violet','Force-energy lining'),shimmer('inward','Force pressure boundary')),
 'Luminous Lure':plan('Algae-green glints and soft enchantment formulas represent the dim glowing lure, without automatically applying a failed-save result.',stars(7,'green','Algal luminescence'),glyph('enchantment','green','Luring presence')),
 "Marshal's Aura":plan('A restrained brass signal and protective circle symbolically mark the basic marshal leadership aura.',flow('outward','ripple','amber','Marshal leadership signal','part01'),glyph('abjuration','amber','Marshal resolve circle')),
 'Miasma':plan('Green toxic haze and a low fog bed represent the poisonous miasma, distinct from a black smoke cloak or creeping ash.',smoke('green','Poisonous miasma'),flow('inward','tendril','green','Toxic ground','part02')),
 'Oath of the Defender':plan('Interlocking oath glyphs and an inward silver field symbolize the chosen defensive oath without guessing a creature trait.',glyph('abjuration','silver','Defender oath circle'),flow('inward','ripple','silver','Oath protection','part01')),
 "Orchard's Endurance":plan('Wooden orbit and inward growth symbolize the bark-like protection. Healing triggered later by a successful save is not repeated.',orbit('wood','green','orbit','Bark protection'),orbit('nature','green','inward','Orchard shelter')),
 'Overwatch Field':plan('A continuous radar sweep and perimeter pings symbolically show warnings and observation from overwatch equipment.',layer('Overwatch radar sweep','template_circle.radar.loop.800px.001.sweep','teal'),radar('round','Overwatch perimeter pings')),
 'Primal Aegis':plan('A thick green energy field and natural inward currents symbolize primal protection against multiple damage types.',energy(1,'green','Primal protective energy'),orbit('nature','green','inward','Primal currents')),
 'Resounding Cascade':plan('Arcane formulae and a neutral refractive cascade represent shared Arcane Cascade; its unknown selected damage type is not guessed.',glyph('evocation','silver','Arcane Cascade formulas'),shimmer('outward','Cascade reach')),
 'Sea Glass Guardians':plan('Crystal-cold orbit and watery bubbles symbolize circling water guardians. Eels and ice-jellyfish silhouettes are an artwork approximation.',orbit('cold','blue','orbit','Sea-glass guardians'),bubbles(1,'teal','Guardian water currents')),
 'Shadowpiercer':plan('Silver moon glints and protective glyphs represent the moonlit anti-shadow field, not an aura of damaging shadow.',stars(8,'silver','Moonlight glints'),glyph('abjuration','silver','Shadow-piercing runes')),
 'Shattershields':plan('Orbiting metal and a steel protective circle symbolize the four pitted plates; native hardness and plate destruction remain PF2e-controlled.',orbit('metal','grey','orbit','Orbiting metal shields'),glyph('abjuration','grey','Segmented shield field')),
 'Shield of the Unified Legion':plan('Outward refraction and metallic reflections symbolize ephemeral shields protecting nearby allies; the separate line attack is not looped.',shimmer('outward','Legion shield reflections'),orbit('metal','silver','outward','Unified shield reach')),
 'Shield the Faithful':plan('Divine glyphs and a pale spirit veil symbolize protection of the faithful. Retaliatory spirit damage is not an ongoing hit.',glyph('conjuration','gold','Faithful divine ward'),energy(2,'silver','Faithful spirit veil')),
 'Soul Well':plan('An inward vortex and pale soul glints represent spirits struggling to escape the well. The aura delays death rather than repeatedly causing it.',vortex('silver','Soul-well vortex'),stars(7,'silver','Trapped soul glints')),
 'Standard of the Primeval Howl':plan('Wild growth and outward readiness symbolize the raw wooden beast banner. No continuous howl is added.',orbit('wood','green','outward','Primeval banner growth'),flow('outward','tendril','amber','Wild readiness')),
 'Stink Sap':plan('Brown-green low fumes and outward odor motes symbolically show stinking sap, without claiming poison damage.',flow('outward','tendril','green','Sap odor spread'),layer('Outward odor motes','particles.outward.greenyellow.02.01','green')),
 'Strategist Stance':plan('Square tactical pings and divination formulas symbolically mark planning and reflex support, distinct from the overwatch radar.',radar('square','Tactical awareness grid'),glyph('divination','blue','Strategy formulas')),
 'Survive the Wilds':plan('Living leaves and inward refraction symbolize protection from an attuned environment, without guessing its particular damage type.',leaves(2,'Attuned wilds'),shimmer('inward','Environmental shelter')),
 'The Hollow Star':plan('Amber crystal glints and an occult illusion circle represent the glowing star and visions. No summoning or apocalypse is depicted.',stars(9,'amber','Hollow-star glow'),glyph('illusion','amber','Occult visions')),
 'Thermal Nimbus':plan('Neutral refraction and heat-flow patterns mark the nimbus while its cold/fire choice is unknown. Native selection supplies the corresponding material.',shimmer('outward','Unspecified thermal boundary'),flow('inward','tendril','silver','Thermal circulation')),
 'Undying Conviction':plan('Inward necromantic protection and a spirit-energy veil symbolize undead resistance to vitality and control. No recurring death or attack.',glyph('necromancy','violet','Undying ward'),energy(1,'violet','Conviction veil')),
 'Benediction':plan('A divine protection circle and gently expanding gold boundary represent the growing AC ward, distinct from Bless’s attack empowerment.',glyph('abjuration','gold','Benediction ward'),flow('outward','ripple','gold','Growing benediction')),
 // Faint: Bless lasts a minute over the whole party, so its field must not bury the map or the tokens in it.
 'Bless':plan('A sustained blessing loop and radiant outward threads represent allied attack accuracy. No repeated healing or casting impacts.',layer('Blessing field','bless.200px.loop','gold',{opacity:.45}),{...flow('outward','ripple','gold','Blessing reach'),opacity:.18}),
 'Canticle of Everlasting Grief (Critical Failure)':plan('Inward grief threads and a curse circle symbolically mark the lasting canticle penalty. No extra audible area or repeated damage.',flow('inward','spirit','violet','Grief threads'),glyph('enchantment','black','Canticle curse circle')),
 'Element Embodied (Air)':plan('Strong whirling currents and wind streaks depict High Winds around the air form. Fire statistics from other forms are excluded.',whirl('silver','High Winds'),wind(1,'Air-form gusts')),
 'Element Embodied (Earth)':plan('A rocky-colored inward orbit and ground transmutation circle symbolize Spike Stones and hazardous ground. Metal footage is an explicit stone-fragment approximation.',orbit('metal','grey','inward','Symbolic stone fragments'),glyph('transmutation','grey','Spike-stone ground')),
 'Element Embodied (Fire)':plan('An intense flame field and outward heat refraction depict the fire form’s Intense Heat.',fire('Intense Heat'),shimmer('outward','Fire-form heat distortion')),
 'Element Embodied (Metal)':plan('An arcing-electricity loop and metallic outward orbit depict the metal form’s electrical field, rather than treating metal as only a grey shield.',layer('Arcing Electricity','template_circle.lightning.01.loop','blue'),orbit('metal','grey','outward','Conductive metal field')),
 'Element Embodied (Water)':plan('A watery vortex and enclosing bubbles depict the water form’s Vortex. Native predicates determine when its aquatic field exists.',vortex('blue','Water Vortex'),bubbles(2,'teal','Vortex bubbles')),
 'Element Embodied (Wood)':plan('Outward wood growth and green leaves depict Lush Growth and difficult terrain; enhanced healing does not become repeated healing hits.',orbit('wood','green','outward','Lush Growth'),leaves(1,'Growing foliage')),
 'Incendiary Aura':plan('Refractive heat and drifting sparks represent combustible potential. Creatures do not appear burning before the separate fire-damage trigger.',shimmer('inward','Combustible heat field'),embers('Incendiary sparks')),
 'Mantle of the Unwavering Heart':plan('A floral pink haze and living leaves represent only the active Overwhelming Perfume aura choice; other mantle options do not emit this field.',flow('outward','heart','pink','Floral perfume haze'),leaves(2,'Perfume foliage')),
 'Monstrosity Form':plan('A fiery shroud and solar glints represent only the native phoenix aura branch. Worm and serpent forms do not inherit this field.',fire('Phoenix shroud'),stars(6,'gold','Phoenix radiance')),
 'Nature Incarnate':plan('A broad natural inward field and living leaves represent the green man’s Green Caress aura, not the kaiju form.',orbit('nature','green','inward','Green Caress'),leaves(1,'Incarnate growth')),
 'Palm-Held Sun':plan('Sunlit brilliance and a gold outward field represent bright and dim sunlight around the held sun; no continuous fire blast.',stars(6,'gold','Held-sun brilliance'),flow('outward','ripple','gold','Sunlight reach')),
 'Qi Form':plan('A silver energy corona and colorful arcane weave symbolize personal qi without assuming the bearer’s chosen color or damage type.',energy(1,'silver','Qi corona'),layer('Personal qi weave','template_circle.aura.02.loop.large','pink')),
 'Shields of the Spirit':plan('Pale shield reflections and inward spiritual threads represent protection by ephemeral spirit shields; retaliatory damage is separate.',shimmer('outward','Spirit-shield reflections'),flow('inward','ripple','silver','Spiritual protection')),
 'Silence':plan('A quiet refractive perimeter and a faint stationary formula circle symbolically mark the sound-suppressing field. No sound or musical notes.',shimmer('inward','Silent boundary'),glyph('illusion','silver','Silence perimeter')),
 'Tempest Cloak':plan('Whirling white wind and a second set of gust streaks depict the literal twisting wind cloak, not a generic blue bubble shield.',whirl('silver','Twisting wind cloak'),wind(2,'Protective gusts')),
 'Horn of Rust':plan('Jagged rusty metal shards orbit the horn-blower in the 5-foot emanation, shedding rust flakes. The +1 AC bonus is native; the separate start-of-turn slashing damage and tetanus exposure are not looped as hits.',orbit('metal','amber','orbit','Rusty shard orbit'),layer('Falling rust flakes','particles.swirl','ruby',{opacity:.75})),
 // A held, carved turnip lantern: a soft warm glow marking the edge of the 20-foot bright light, with drifting
 // candle-like flickers. Not a starburst or radiating pattern (both read as a spell blast), and not fire.
 'Turnip Lantern':plan('A carved turnip lantern sheds flickering warm light across its 20-foot bright-light aura: a soft golden glow rims the lit area and small orange lights drift and flicker inside it. The +1 status bonus against unholy creatures stays a native modifier; no fear, flames or attack is shown.',energy(1,'gold','Lantern light reach'),layer('Flickering lantern light','fireflies.many.01','amber')),
 'Divine Presence':plan('Outward spirit energy and a divine circle represent the godlike spiritual presence. Within-field movement remains a separate native action.',flow('outward','ripple','silver','Spiritual presence'),glyph('divination','violet','Divine presence glyphs')),
};
const aliases={
 'Curse of Creeping Ashes':'Creeping Ashes','Multifaceted Will':'Manifest Will',
 'Unleash Yaoguai Might':'Celestial Yaoguai Might','Overwhelming Perfume':'Mantle of the Unwavering Heart',
 'Shining Symbol Weakness':'Shining Symbol',
};
const traditionPlans={
 arcane:plan('Raw arcane energy and formulas manifest the selected arcane tradition.',energy(1,'blue','Raw arcane energy'),glyph('evocation','blue','Arcane formulas')),
 divine:plan('Inward and outward divine fields symbolize the selected tradition’s cycle of life and death.',flow('inward','ripple','silver','Divine cycle inward'),flow('outward','ripple','gold','Divine cycle outward')),
 occult:plan('Symmetric occult circles and violet threads manifest the selected occult tradition.',glyph('enchantment','violet','Occult symmetry'),flow('inward','tendril','violet','Occult threads')),
 primal:plan('Outward growth and inward wood currents symbolize the selected primal tradition’s growing and withering field.',orbit('nature','green','outward','Primal growth'),orbit('wood','green','inward','Primal cycle')),
};
const thermalPlans={
 fire:plan('Warm outward currents and glowing embers depict the native fire choice of Thermal Nimbus.',flow('outward','tendril','amber','Fire thermal currents'),embers('Thermal embers')),
 cold:plan('Cold inward currents and refractive chill depict the native cold choice of Thermal Nimbus.',orbit('cold','blue','inward','Cold thermal currents'),shimmer('inward','Thermal chill')),
};
export const auraAbilityName=name=>{const n=name.replace(/^(?:Aura|Effect|Spell Effect|Stance):\s*/,'');return aliases[n]??n;};
// Ground fields that fill the aura's radius; a design of only motes, stars or leaves would not show how far it reaches.
const REACH=/^(template_circle\.|magic_signs\.circle\.|aura_themed\.|fire_ring\.|energy_field\.|bless\.)/;
export const showsReach=spec=>spec.layers.some(l=>l.roots.some(r=>REACH.test(r)));
export function buildAuraDesign(entry,db){
 const ability=auraAbilityName(entry.name),spec=plans[ability];
 if(!spec)throw Error(`Native aura lacks a reviewed field composition: ${entry.name}`);
 for(const s of [spec,...Object.values(ability==='Manifest Will'?traditionPlans:ability==='Thermal Nimbus'?thermalPlans:{})])if(!showsReach(s))throw Error(`Aura design shows no reach: ${ability}`);
 const compile=(spec,id)=>({id,rationale:spec.rationale,layers:spec.layers.map((layer,i)=>{
  const {roots,palette,...options}=layer,[color,tint]=palette,chosen={};
  for(const [edition,rows] of Object.entries(db)){
   let candidates=[];
   for(const root of roots){candidates=rows.filter(r=>(r.key===`jb2a.${root}`||r.key.startsWith(`jb2a.${root}.`))&&assetGeometry(r)==='radial'&&!/intro|outro|complete|outburst|pulse/.test(r.key));if(candidates.length)break;}
   if(!candidates.length)throw Error(`No continuous radial ${roots.join('/')} field in ${edition}`);
   const colored=candidates.filter(r=>r.key.split('.').includes(color));
   chosen[edition]=(colored.length?colored:candidates).sort((a,b)=>colorAffinity(b.key,color)-colorAffinity(a.key,color)||a.key.localeCompare(b.key))[0];
  }
  return {...options,stageId:`field-${i+1}`,assets:[...new Set([chosen.patreon.key,chosen.free.key])],tintEnabled:true,colorize:true,tint,
   editions:Object.fromEntries(Object.entries(chosen).map(([edition,row])=>[edition,{key:row.key,files:variantFiles(row),colorSubstitution:!row.key.split('.').includes(color)}]))};
 })});
 return {...compile(spec,ability),reviewedDescriptionHash:entry.descriptionHash,
  ...(ability==='Manifest Will'?{choice:'tradition',variants:Object.fromEntries(Object.entries(traditionPlans).map(([k,v])=>[k,compile(v,`${ability}:${k}`)]))}:{}),
  ...(ability==='Thermal Nimbus'?{choice:'thermal',variants:Object.fromEntries(Object.entries(thermalPlans).map(([k,v])=>[k,compile(v,`${ability}:${k}`)]))}:{})};
}
