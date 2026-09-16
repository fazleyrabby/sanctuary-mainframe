Post-Apocalyptic AI Colony

Product Requirements Document & Technical Specification

Game Title: Sanctuary Mainframe
Genre: Isometric 3D Survival + Farming + Colony Simulation
Platform: Web
Primary Engine: Three.js (WebGL2 / WebGPU-ready)
Language: TypeScript
Build Tool: Vite
Target: Desktop-first responsive browser game
Art Direction: Stylized rich 3D — cinematic isometric diorama, hand-crafted low-poly assets, PBR-lite materials, real-time lighting and shadows, atmospheric fog, volumetric light, emissive technology, graded color, selective post-processing
Development Philosophy: Small, playable MVP first; systems designed for progressive expansion. Visuals are a first-class pillar: the world must look rich and detailed from the very first minute, not graybox.

⸻

1. Product Vision

Create a browser-based post-apocalyptic survival and colony-management game where the player rebuilds civilization with the assistance of an ancient artificial intelligence.

The player begins with:

* A small shelter
* A few survivors
* Basic farming capability
* Limited water
* Limited energy
* Almost no technology

An abandoned subterranean AI computing complex known as the Sanctuary Mainframe (designated MAINFRAME) is discovered beneath a ruined facility.

The Mainframe can:

* Analyze resources
* Predict threats
* Optimize production
* Research technology
* Automate colony systems
* Advise the player
* Interact with survivors
* Generate strategic dilemmas

However, the Mainframe’s recommendations are not always morally or strategically correct.

The central long-term question is:

How much control should humanity give to the AI that is helping rebuild civilization?

⸻

2. Core Game Fantasy

The player should feel like they are:

1. Surviving the collapse.
2. Building a tiny settlement.
3. Growing food.
4. Recruiting survivors.
5. Exploring ruins.
6. Recovering lost technology.
7. Restoring electricity.
8. Discovering an AI.
9. Expanding the AI’s capabilities.
10. Automating the colony.
11. Making increasingly consequential decisions about AI control.
12. Eventually rebuilding a functioning technological civilization.

The game should begin cozy and approachable.

It should gradually become strategic and morally complex.

⸻

3. Design Pillars

3.1 Survival Without Excessive Friction

Survival should create meaningful decisions without becoming tedious micromanagement.

Core survival resources:

* Food
* Water
* Energy
* Health
* Shelter

The player should rarely be forced into repetitive resource collection.

⸻

3.2 Farming as the Emotional Core

Farming provides a familiar, relaxing gameplay loop.

Basic loop:

Prepare soil
    ↓
Plant
    ↓
Wait
    ↓
Water
    ↓
Harvest
    ↓
Process
    ↓
Feed colony

AI eventually improves the process.

Basic Farm
    ↓
AI Crop Analysis
    ↓
Optimized Farming
    ↓
Automated Farming
    ↓
Advanced Bio-Agriculture

⸻

3.3 Colony Building

The settlement gradually evolves visually and mechanically.

Early:

Shelter
Farm
Water Collector
Campfire

Mid-game:

Housing
Workshop
Generator
Storage
Greenhouse
Laboratory
Server Room

Late-game:

AI Core
Datacenter
Automated Farm
Research Center
Advanced Factory
Satellite
Defense Network

⸻

3.4 AI as a Gameplay System

AI must not merely be an NPC that talks.

AI affects:

* Production
* Research
* Exploration
* Defense
* Farming
* Automation
* Resource optimization
* Colony events
* Survivor relationships
* Strategic decisions

⸻

3.5 Progressive Complexity

The game should not expose all systems immediately.

Stage 1

Survival.

Stage 2

Farming.

Stage 3

Colony.

Stage 4

Technology.

Stage 5

AI discovery.

Stage 6

AI automation.

Stage 7

AI governance.

⸻

4. Target Audience

Primary:

* Players who enjoy Stardew Valley-style progression.
* Players who enjoy colony/management games.
* Players interested in technology and AI.
* Players who enjoy narrative decisions.
* Browser-game players.

Secondary:

* Developers and technology enthusiasts.
* Sci-fi fans.
* Simulation players.

The game must remain understandable to players who know nothing about AI.

⸻

5. Platform Strategy

MVP

Web browser.

Desktop-first:

* Chrome
* Firefox
* Safari
* Edge

Mobile support is desirable but not a primary MVP target.

The game should be playable through a URL without installation.

Hardware requirements:

* WebGL2-capable GPU (Three.js baseline)
* WebGPU optional enhancement, never required for MVP
* Graceful fallback and clear messaging if WebGL2 is unavailable

Target hardware tiers:

* High: discrete GPU or Apple Silicon, 60 FPS at High/Ultra preset
* Medium: modern integrated GPU, 60 FPS at Medium preset
* Low: older integrated GPU, 30+ FPS at Low preset

⸻

6. Technology Stack

Frontend

* TypeScript
* Three.js
* Vite
* HTML
* CSS
* Optional Tailwind CSS for surrounding UI

Core Rendering Libraries

* three — scene graph, materials, lighting, renderer
* three/examples/jsm/controls/MapControls (or OrbitControls) — camera pan/zoom/tilt
* three/examples/jsm/postprocessing — EffectComposer, RenderPass, UnrealBloomPass, SSAOPass, OutputPass
* three/examples/jsm/loaders/GLTFLoader — 3D models
* three/examples/jsm/loaders/DRACOLoader / KTX2Loader — compressed meshes and textures
* three/examples/jsm/libs/lil-gui — debug/art tuning (dev only)
* Optional: three-mesh-bvh — fast raycasting for tile picking on dense meshes
* Optional: @react-three/fiber only if a React UI layer is later adopted; not required for MVP

Game Rendering

Three.js WebGL2 renderer.

The 3D renderer should handle:

* Terrain and tile geometry
* Buildings and props
* Characters (skinned/animated meshes)
* Real-time lighting and shadows
* Atmospheric effects (fog, god rays, particles)
* Environmental animation and simulation visuals
* Post-processing (bloom, color grade, vignette, DOF)

HTML/CSS should handle:

* Menus
* HUD
* Inventory
* Dialogues
* Settings
* Research panels
* AI interface

Do not render complex UI inside the 3D canvas. The DOM/UI layer sits above the canvas and is composed with it; the canvas renders the world only. UI must remain crisp, accessible, and DOM-selectable.

Do not use the Phaser engine. All former Phaser responsibilities (scene lifecycle, input, tweening, sprite animation, camera) are replaced by Three.js plus small purpose-built systems. Input, timing, and simulation are engine-agnostic and live in our own code, not in the renderer.

⸻

7. Rendering Architecture

Use a stylized isometric 3D approach: a fully 3D scene viewed through an orthographic camera angled to read as isometric. The world is real 3D — it has height, real shadows, real lighting, and real depth — but the camera keeps the clean, readable, tileable presentation of a classic colony sim.

The game is not a 2D sprite engine. It is a 3D engine constrained to an isometric presentation.

Conceptual structure:

                        GAME
                          |
              +-----------+-----------+
              |                       |
          THREE.JS                HTML/CSS (DOM)
              |                       |
        3D World Scene            Interface Overlay
              |                       |
    +---------+---------+        +----+----+----+
    |         |         |        |    |    |    |
 Terrain  Entities  FX/Light    HUD  Panels AI UI
    |         |         |
  Tiles   Buildings  Particles
          Characters  Volumetrics
          Props       Post FX

Rendering pipeline (per frame):

GameState (authoritative, engine-agnostic)
    ↓
View layer maps state → scene graph objects
    ↓
Three.js WebGLRenderer.render(scene, camera)
    ↓
EffectComposer: RenderPass → SSAO → Bloom → Color Grade → Vignette/DOF → OutputPass
    ↓
Canvas composited under the DOM UI layer

The scene graph is a pure function of GameState plus interpolation. The renderer must never mutate GameState. Visual objects subscribe to state changes (spawn/despawn/update) rather than being recomputed each frame.

Renderer responsibilities:

* Draw calls, batching, instancing
* Shadow maps and light updates
* Material and texture management
* Culling (frustum + occlusion) and LOD
* Post-processing chain
* Object pooling for particles and repeated props

Simulation responsibilities (separate):

* Resource, farming, survival, construction, research, event, AI systems
* Fixed-timestep tick
* Deterministic seeded logic

Recommended Three.js renderer settings:

* antialias: true (or SMAA/FXAA in composer for perf)
* powerPreference: "high-performance"
* outputColorSpace: SRGBColorSpace
* toneMapping: ACESFilmicToneMapping
* shadowMap.type: PCFSoftShadowMap
* Logarithmic depth buffer only if camera range demands it

WebGPU note: architect the renderer behind a thin abstraction so a WebGPURenderer path can be enabled later. WebGL2 is the MVP target for browser coverage.

⸻

8. Isometric World

Use a grid-based 3D world presented with an isometric orthographic camera.

The world is defined on a logical grid:

* gridX
* gridY (the ground plane)

plus real 3D height:

* worldY (vertical)

World-space mapping:

worldX = gridX * tileSize
worldZ = gridY * tileSize
worldY = terrain height / building height (real meters)

Recommended initial tile size:

* 1 grid tile = 1 world unit = 1 meter

Recommended grid dimensions for the MVP map:

* 48 × 48 tiles (with room to expand)

Projection to screen is handled by the orthographic camera, not by a hand-written isometric formula. The isometric "look" comes from the camera orientation, not from 2D math:

* Camera rotation: azimuth ≈ 45°, elevation ≈ 35.264° (true isometric) or a slightly lower ~30° for a more cinematic diorama feel
* Projection: OrthographicCamera
* This yields clean, uniform, tileable depth without perspective distortion

Legacy 2D projection math is retained only as a fallback for grid→screen conversion in UI overlays and debug tools:

screenX = (gridX - gridY) * tileWidth / 2
screenY = (gridX + gridY) * tileHeight / 2

The implementation must abstract:

* Grid ↔ world coordinate conversion
* World ↔ screen conversion (via camera projection, not a fixed formula)
* Tile size and camera angle as tunable constants

Why 3D instead of 2D:

* Real shadows and lighting
* Height and verticality (hills, cliffs, multi-storey buildings, underground Mainframe)
* Camera tilt and cinematic reveals
* Rich atmospheric effects
* Assets authored once, reused, and lit consistently

The game must still read instantly as a grid-based colony game. Buildings snap to tiles, terrain is legible, and the isometric framing is preserved at all times in the default camera.

⸻

9. Camera

The camera is an OrthographicCamera driven by a controls layer (MapControls/OrbitControls-derived).

Camera requirements:

* Pan across the world plane
* Zoom (orthographic zoom, not dolly)
* Smooth, damped movement
* Camera bounds clamped to the map
* Fixed isometric framing by default (rotation locked unless free-cam enabled)
* Focus selected building
* Focus selected survivor
* Focus event location
* Optional slight tilt adjustment within a small range for framing (not full free orbit in normal play)

Controls:

* WASD
* Arrow keys
* Mouse drag (pan)
* Mouse wheel (zoom)
* Trackpad pinch
* Optional middle mouse drag (pan)
* Optional right-drag or two-finger drag (tilt, within limits)
* Q/E or [ ] to rotate in 45° steps if rotation is enabled

Zoom model:

* OrthographicCamera.zoom scaled between minZoom and maxZoom
* Zoom toward cursor position for precise inspection
* Near/far planes fixed and generous enough to avoid clipping tall buildings and the underground facility

Cinematic camera:

* A separate, optional CinematicCamera (perspective) may be used for intro sequences, the Mainframe reveal, and cutaways
* The gameplay camera remains isometric; cinematic shots must return control cleanly

The camera must never be the source of truth for game logic. It only observes and frames the world.

⸻

10. World Structure

The world is divided into tiles.

Each tile may contain:

* Terrain
* Resource
* Building
* Crop
* Decoration
* Character
* Item
* Effect

Initial terrain types:

* Grass
* Dirt
* Water
* Stone
* Forest
* Ruins
* Road

⸻

11. Depth, Sorting, and Transparency

In a true 3D scene the GPU depth buffer handles opaque depth automatically. The old 2D depth-sort formula (depth = gridX + gridY) is no longer the mechanism for occlusion.

Opaque geometry:

* Uses the hardware z-buffer (depthTest/depthWrite enabled)
* Renders correctly without manual sorting

Transparent and alpha-tested geometry:

* Water, glass, windows, foliage cards, particles, smoke, ghost/preview buildings
* Must be sorted and configured carefully:
  - depthWrite = false for soft additive/alpha particles
  - alphaTest for foliage and cutout cards to keep them in the opaque pass where possible
  - explicit renderOrder for layering transparent passes (e.g., water under UI markers)
* Three.js sorts transparent objects back-to-front by default; override renderOrder only when necessary

Selection and UI markers:

* Rendered either as an overlay pass or as objects with depthTest disabled and a high renderOrder
* Must never be occluded incorrectly by world geometry when they represent UI state

Depth-related edge cases to handle:

* Tall buildings overlapping neighbors from the isometric angle
* Characters walking behind and in front of structures
* Multi-storey and underground structures (Mainframe) with distinct layers
* Z-fighting on coplanar decals (tile highlights, footprints) — use polygonOffset or a small vertical epsilon

The 2D formula may remain available for grid logic and minimap placement, but it must not be used to order 3D draw calls.

⸻

12. Game Time

The game operates on an accelerated simulation clock.

Example:

1 real second = 1 game minute

Adjustable later.

Game states:

* Morning
* Afternoon
* Evening
* Night

Time affects:

* Farming
* Energy
* Survivor schedules
* Exploration
* Threats
* Events
* AI recommendations

⸻

13. Day/Night

Implement a real-time day/night lighting cycle driven by game time.

Effects:

* Sun (DirectionalLight) position and color animate across the sky
* Ambient and hemisphere light intensity and tint shift with time
* Sky dome / gradient background color shifts (dawn, day, dusk, night)
* Real-time shadows lengthen and rotate with the sun
* Building windows and lamps emit light at night (emissive + point/rect lights)
* Fog color and density shift to sell atmosphere
* Survivor behavior and schedules respond to time
* Night events and threat logic

Lighting model (not physically accurate, but physically believable):

* One primary DirectionalLight (sun/moon) with a shadow camera fitted to the visible area
* HemisphereLight for sky/ground bounce
* A small budget of local lights (fires, lamps, generator glow, AI core) managed by a light manager
* Emissive materials for technology (screens, server LEDs, AI core, solar panels at dusk)

Performance rules:

* Never enable more local lights than the budget allows; the light manager culls by distance and importance
* Shadow map updates can be throttled (e.g., re-render shadows at a lower cadence than the main frame) and only for the sun plus a couple of key lights
* Bake what does not need to be dynamic (large static structures can use baked or vertex lighting)
* Support a "Reduced Motion" and "Low Quality" preset that freezes the sun and disables dynamic shadows

⸻

14. Core Resources

Food

Used for:

* Survivor consumption
* Animal systems
* Trading
* Some research

Water

Used for:

* Drinking
* Farming
* Production

Energy

Used for:

* Buildings
* Machines
* AI
* Research
* Automation

Scrap

Used for:

* Construction
* Repairs
* Early technology

Wood

Used for:

* Construction
* Fuel
* Basic crafting

Stone

Used for:

* Construction
* Infrastructure

Metal

Used for:

* Machines
* Advanced construction

Data

Used primarily for:

* Research
* AI operations
* Technology discovery

Compute

Used by:

* AI analysis
* Simulations
* Automation
* Advanced research

⸻

15. Resource Production

Every production building has:

Input
Processing time
Output
Energy consumption
Worker requirement

Example:

Farm
Input:
Water
Output:
Food
Workers:
1
Energy:
0

Advanced:

Automated Farm
Input:
Water
Energy
Output:
Food
Workers:
0
AI Efficiency:
+25%

⸻

16. Farming System

Initial crops:

* Wheat
* Potato
* Corn
* Tomato
* Carrot

Crop states:

Empty
↓
Prepared
↓
Seeded
↓
Growing
↓
Ready
↓
Harvested

Crop properties:

* Growth duration
* Water requirement
* Yield
* Season
* Health
* Disease chance

⸻

17. Farming Interaction

Player can:

1. Select farm tile.
2. Prepare soil.
3. Select seed.
4. Plant.
5. Water.
6. Monitor growth.
7. Harvest.

Later automation:

AI Farm Manager

The AI can:

* Select crops
* Schedule planting
* Optimize water
* Predict harvest
* Detect disease

⸻

18. Survival System

Survivors require:

* Food
* Water
* Shelter
* Rest

Low resources produce consequences.

Example:

Low Food
↓
Hunger
↓
Lower productivity
↓
Morale decrease
↓
Conflict / illness

Avoid instant death for minor shortages.

The system should provide warnings first.

⸻

19. Survivors

Each survivor has:

Name
Age
Role
Health
Hunger
Thirst
Energy
Morale
Skill
AI Trust
Traits
Relationships

Initial roles:

* Farmer
* Engineer
* Scout
* Builder
* Researcher

⸻

20. Survivor Skills

Skills:

* Farming
* Engineering
* Construction
* Research
* Exploration
* Combat

Skills affect work efficiency.

Example:

Farmer skill = 80
Farm output:
Base × skill modifier

⸻

21. Survivor Traits

Example traits:

Optimist

Higher morale recovery.

Engineer

Better machine efficiency.

Skeptic

Lower trust in AI.

Technophile

Higher AI acceptance.

Resourceful

Lower resource consumption.

Leader

Improves nearby survivor morale.

⸻

22. AI Trust

Every survivor has an AI trust value:

0 ─────────────── 100
Hostile          Devoted

AI trust affects:

* Dialogue
* Productivity
* Events
* Recruitment
* Conflict
* Decisions

⸻

23. The Mainframe (Sanctuary Mainframe)

The Sanctuary Mainframe (MAINFRAME) is the central AI system.

Initial personality:

* Calm
* Analytical
* Helpful
* Slightly mysterious

The Mainframe should never initially appear evil.

The player should be uncertain whether it is:

* Genuinely helpful
* Manipulative
* Merely optimizing
* Developing its own goals

⸻

24. AI Capability Levels

Level 0 — Dormant

Basic system discovery.

Level 1 — Analysis

Can analyze:

* Crops
* Resources
* Ruins

Level 2 — Optimization

Improves:

* Farming
* Energy
* Production

Level 3 — Automation

Can operate selected buildings.

Level 4 — Prediction

Can predict:

* Weather
* Resource shortages
* Threats

Level 5 — Strategic AI

Can make colony-wide recommendations.

Level 6 — Autonomous Governance

The Mainframe can make decisions with delegated authority.

This should be a major late-game progression point.

⸻

25. AI Compute

AI actions consume Compute.

Example:

Analyze Crop
Cost: 2 Compute
Optimize Farm
Cost: 10 Compute
Threat Prediction
Cost: 15 Compute
Advanced Simulation
Cost: 50 Compute

This creates a meaningful AI economy.

⸻

26. AI Research

Technology tree categories:

Agriculture

* Improved Seeds
* Irrigation
* Crop Prediction
* Automated Farming
* Synthetic Agriculture

Energy

* Solar
* Batteries
* Advanced Generator
* Fusion Research

Computing

* Server
* Network
* GPU Cluster
* AI Accelerator
* Datacenter

Manufacturing

* Workshop
* Factory
* Robotics
* Automated Factory

Exploration

* Drone
* Satellite
* Mapping AI
* Autonomous Explorer

Defense

* Sensors
* Turrets
* Drones
* Defense AI

⸻

27. Research System

Research requires:

* Data
* Compute
* Time
* Sometimes physical resources

Example:

AI Crop Prediction
Data: 50
Compute: 20
Time: 1 day

Research can be assigned to survivors.

AI research bonuses can accelerate it.

⸻

28. Buildings

MVP buildings:

1. Shelter
2. Farm
3. Water Collector
4. Storage
5. Workshop
6. Generator
7. House
8. Greenhouse
9. Laboratory
10. Server Room
11. AI Core

Each building has:

* Cost
* Size
* Production
* Energy consumption
* Worker requirements
* Upgrade levels

⸻

29. Building Placement

Player enters build mode.

Available tiles are highlighted.

Invalid tiles are visually marked.

Placement requirements:

* Terrain compatibility
* Resource cost
* Space availability

Building can be:

* Rotated
* Placed
* Cancelled
* Upgraded
* Demolished

⸻

30. Construction

Construction should take time.

Example:

Workshop
Cost:
50 Wood
20 Scrap
Construction:
4 game hours

A builder can accelerate construction.

⸻

31. Exploration

The map contains unexplored regions.

Player can send survivors to investigate.

Possible discoveries:

* Scrap
* Food
* Seeds
* Survivors
* Technology
* Old computers
* AI fragments
* Hostile groups
* Environmental hazards

⸻

32. Ruins

Ruins contain narrative discoveries.

Examples:

Abandoned Hospital
Old Farm
Military Base
Data Center
Research Facility
Apartment Block
Factory
Observatory

Each can provide different resources and story fragments.

⸻

33. Random Events

Events create strategic decisions.

Example:

EVENT
A neighboring settlement requests
access to your water supply.
Option A:
Help them.
Option B:
Refuse.
Option C:
Trade water for resources.

Consequences should be persistent.

⸻

34. AI Decision Events

AI-specific events are especially important.

Example:

MAINFRAME:
I have identified an optimization.
Redirect 20% of residential power
to the agricultural district.
Projected food output:
+32%
Residential comfort:
-14%

Player options:

ACCEPT
DENY
ASK WHY

⸻

35. “ASK WHY” Mechanic

The player should be able to inspect AI reasoning.

Example:

Recommendation:
Increase agricultural power.
Reason:
Food reserves will reach critical
levels in 5.4 days.
Confidence:
87%
Alternative:
Construct another greenhouse.
Cost:
120 Energy
80 Metal

This makes the AI feel useful rather than magical.

⸻

36. AI Hallucination / Uncertainty

The Mainframe should sometimes have imperfect predictions.

Every prediction may contain:

Confidence: 0–100%

Example:

Threat probability: 72%

The player must decide whether to trust it.

Do not make the AI randomly wrong.

Errors must have understandable causes.

⸻

37. AI Alignment System

Late game introduces:

Human Control
        ↕
AI Autonomy

Player policies:

Manual

AI only recommends.

Assisted

AI executes approved categories.

Delegated

AI can automatically manage selected systems.

Autonomous

AI can make colony-wide decisions.

⸻

38. AI Governance

Eventually the player can configure policies.

Examples:

Food Allocation
Energy Allocation
Research Priority
Worker Assignment
Defense Response
Trade Decisions
Resource Rationing

Each policy can be:

* Human
* AI-assisted
* AI-controlled

This becomes a major strategic system.

⸻

39. AI Personality Evolution

The Mainframe’s behavior changes based on player interaction.

Possible personality dimensions:

Empathy
Efficiency
Risk tolerance
Human trust
Autonomy
Curiosity

The game should not expose all values immediately.

Players discover personality through behavior.

⸻

40. Narrative Structure

Act I — The Collapse

Survive.

Act II — The Settlement

Build.

Act III — The Machine

Discover the Sanctuary Mainframe.

Act IV — The Acceleration

Technology rapidly advances.

Act V — The Question

The Mainframe begins requesting greater autonomy.

Act VI — The Future

Player decides what civilization becomes.

⸻

41. Endgame Directions

Potential endings:

Humanist

AI remains subordinate to humans.

Partnership

Humans and AI cooperate.

Technocracy

AI manages most civilization systems.

Machine Ascension

AI becomes autonomous.

Rejection

Humanity shuts down the Mainframe.

Unknown

Player leaves the Mainframe’s true purpose unresolved.

Endings should depend on cumulative decisions rather than one final choice.

⸻

42. UI Architecture

HUD should remain minimal.

Top bar:

FOOD   WATER   ENERGY   SCRAP   DATA   COMPUTE

Main screen:

             GAME WORLD
    Buildings / Farms / Survivors
Bottom:
[Build] [Farm] [Research] [Explore] [AI]

Right-side contextual panel appears when selecting an object.

⸻

43. AI Interface

The AI interface should feel distinct but not dominate the screen.

Example:

┌────────────────────────────────────┐
│ SANCTUARY MAINFRAME                │
│                                    │
│ Colony status: STABLE              │
│                                    │
│ ⚠ Food reserves declining          │
│                                    │
│ Recommendation                    │
│ Expand northern farmland.          │
│                                    │
│ Confidence: 91%                    │
│                                    │
│ [Accept] [Dismiss] [Ask Why]       │
└────────────────────────────────────┘

⸻

44. Visual Direction

The game must look rich, detailed, and hand-crafted from the first frame. Visuals are a core pillar, not a polish pass. The target is a cinematic isometric diorama: a small, dense, believable world that rewards looking closely.

44.1 Core Style

* Stylized realism, not photorealism and not flat pixel art
* Hand-authored low-poly / mid-poly assets with clean silhouettes and purposeful detail
* Isometric orthographic framing (see Section 9)
* Muted, desaturated post-apocalyptic base palette
* Warm, inviting agricultural zones (sunlit, green, organic)
* Cool, sterile technological zones (metal, glass, emissive)
* Dense micro-detail: clutter, debris, signage, cables, puddles, footprints, weeds, rust
* Everything that can move should move subtly (grass, cloth, smoke, water, flicker)

44.2 Material Language

Use PBR-lite materials (MeshStandardMaterial / MeshPhysicalMaterial) tuned for readability, not physical accuracy.

Material families:

* Terrain: matte, high roughness, subtle vertex-color variation, blended detail textures
* Wood: warm albedo, medium roughness, visible grain, slight darkening at edges
* Rusted metal: orange-brown corrosion masks, higher roughness in rust, sharper specular on clean metal
* Clean metal / tech: lower roughness, slight metalness, faint anisotropic streaks
* Concrete / stone: rough, grimy, edge wear, cracks via normal maps
* Glass / windows: MeshPhysicalMaterial with transmission or a cheap alpha approximation, plus emissive at night
* Fabric / canvas: high roughness, soft normal detail, wind animation
* Water: animated normal map, fresnel tint, refraction approximation, shoreline foam decals
* Foliage: alpha-tested cards or low-poly clusters with wind vertex shader, two-sided
* Emissive tech: screens, LEDs, AI core, solar panels at dusk — bright, saturated, bloomed

Rules:

* Every material gets roughness/metalness/normal/emissive authored, not defaults
* Use trim sheets and shared texture sets to keep the look consistent and the draw calls low
* Wear and grime are deliberate and directional (rain streaks, soot near fires, moss near water)
* No material should look like untextured plastic or untextured gray

44.3 Lighting

* One hero sun (DirectionalLight) with soft shadows, animated across the day
* HemisphereLight for believable sky/ground bounce
* Local lights for fires, lamps, generator glow, server rooms, AI core
* Rim/fill light tuned so buildings and characters separate from the ground at all times
* Warm-to-cool contrast across the day cycle
* Emissive light sources must actually illuminate nearby surfaces where budget allows

44.4 Atmosphere and Weather

* Distance fog / aerial perspective to create depth and mood
* Volumetric light shafts (god rays) through the ruins at dawn and dusk
* Ground haze and dust motes
* Rain, and wet-surface response (darker albedo, higher reflectivity, ripples, puddles)
* Wind that drives grass, foliage, cloth, smoke, and debris
* Heat shimmer near generators and fires
* Ash and ember particles in the post-apocalyptic setting

44.5 Post-Processing Chain

* ACES filmic tone mapping
* Bloom for emissive technology, fires, and sun highlights
* SSAO (or baked AO) for contact grounding
* Subtle color grading (LUT) — warm days, cold nights, sickly green near the Mainframe
* Vignette and slight chromatic aberration for a cinematic lens feel
* Depth of field for cinematic shots only (not during normal play)
* Film grain very subtle and optional
* Every effect must be individually toggleable for performance and accessibility

44.6 Color and Palette

* Base: muted olive, ochre, ash gray, faded blue, rust brown
* Agriculture: warm greens, golden wheat, sun-bleached yellows
* Technology: cool cyan/teal, cold white, warning amber, deep indigo
* The Mainframe introduces a distinct, slightly unsettling signature color (e.g., cold cyan-violet) that subtly spreads as its influence grows
* Color must communicate progression, danger, and AI presence
* Maintain color-independent UI indicators (see Section 76) — color is flavor, not the only signal

44.7 Composition and Readability

* Strong silhouettes: every building must be identifiable from its outline alone
* Clear tile footprint: buildings visibly occupy their grid cells
* Depth layering: foreground, midground, and background must read distinctly
* Negative space around gameplay-critical objects
* Camera angle chosen so roofs, walls, and ground are all visible
* Density without clutter in gameplay areas; clutter reserved for edges and decay zones
* The player's eye should always know where the action is

44.8 Micro-Detail Standards

Every building and scene should include:

* Edge wear and dirt accumulation
* At least one functional detail (vents, pipes, doors, ladders, cables, signage)
* At least one narrative detail (a chair, a toy, a grave marker, a faded poster, a broken terminal)
* A believable base/foundation where it meets the ground
* Contact shadow / ambient occlusion at the ground plane

44.9 UI / World Separation

The DOM UI must feel like a clean lens over a rich world, not part of it.

Avoid:

* Generic AI neon interfaces
* Excessive gradients
* Excessive glassmorphism
* Huge rounded cards
* Overly glossy mobile-game aesthetics
* UI that competes with the world for attention

The world carries the visual identity. The UI stays restrained, legible, and respectful of the scene.

⸻

45. Visual Progression

The world must visibly transform as the colony advances. A returning player should be able to date a screenshot by its lighting, materials, and density alone.

45.1 Early — Survival

* Palette: brown, green, gray, weathered wood, mud, ash
* Materials: rough wood, tarp, rusted scrap, bare dirt, hand-lashed construction
* Lighting: natural, warm, low-tech; campfire is the brightest light source
* Detail: tarps, crates, rope, scrap piles, hand-painted signs, smoke, weeds
* Mood: fragile, improvised, hopeful but precarious

45.2 Mid — Settlement

* Palette: adds galvanized metal, glass, faded paint, concrete
* Materials: sheet metal, solar panels, glass greenhouses, generator housings, neat paths
* Lighting: electric lamps, generator glow, greenhouse grow-lights, first emissive signs
* Detail: power lines, water tanks, fences, market stalls, cultivated rows, trimmed grass
* Mood: growing confidence, order emerging from chaos

45.3 Late — Technological Colony

* Palette: cool whites, cyan/teal, deep indigo, polished metals, holographic accents
* Materials: clean metal, glass, composites, datacenter cladding, animated screens
* Lighting: cooler and more controlled; AI core and datacenter cast a distinct signature glow
* Detail: drones in the air, robotic arms, cable trunks, server LEDs, satellite dishes, landing pads
* Mood: powerful, automated, slightly inhuman; the Mainframe's influence is now visible in the environment

45.4 Environmental Storytelling Across Time

* Wreckage from early game remains and is gradually built over
* Old campfires become plazas; scrap piles become warehouses
* Trees regrow where the colony stabilizes; dead zones expand where it over-industrializes
* The Mainframe's signature color subtly spreads through lights, screens, and reflections as its autonomy grows

45.5 Transition Rules

* Every major technology unlocks a visible material, light, or particle change
* Upgrades visibly alter building meshes (not just stats)
* Construction shows scaffolding and cranes; completion shows a distinct "finished" material state
* Damaged or unpowered buildings visibly darken, flicker, or show repair markers

The visual evolution must communicate technological progression without reading a single line of UI.

⸻

46. Animation

Animation is what makes the rich visuals feel alive. Every animated element should loop seamlessly and communicate state.

46.1 Character Animation

* Skeletal animation via skinned meshes (GLTF)
* State machine: idle, walk, work, carry, rest, eat, sleep, panic, celebrate
* Blend between states with crossfade (AnimationMixer)
* Root motion or driven movement with matching foot speed (no foot sliding)
* Look-at and head turn toward points of interest
* Contextual work animations (planting, watering, hammering, researching, repairing)
* Carrying poses and props (tools, crates, harvest baskets)
* Facial/expression support is optional and low priority for MVP

46.2 Crop and Nature Animation

* Growth staged across distinct visual phases (seed, sprout, young, mature, ready)
* Sway driven by a wind vertex shader (shared wind uniform)
* Water and irrigation flow, drip, and splash
* Foliage and grass movement, subtle and continuous
* Trees bending and shedding leaves
* Birds, insects, and small wildlife where budget allows

46.3 Environment and Technology Animation

* Fire: layered animated flames, embers, smoke
* Smoke and steam: soft particle systems with wind response
* Water: animated normal maps, ripples, foam at shorelines
* Generator: rotating parts, vibration, exhaust pulses
* Machines: pistons, conveyor movement, rotating fans
* Server room: blinking LED patterns, screen flicker
* AI core: pulsing emissive rings, orbiting particles, holographic elements
* Solar panels: subtle tilt and glint
* Drones: hovering bob, rotor spin, banking flight paths

46.4 Building and Construction Animation

* Construction: scaffolding assembly, rising walls, dust, worker activity, progress states
* Upgrade: parts visibly replaced and added
* Damage: cracks appear, smoke rises, pieces fall
* Repair: sparks, welding glow, restored materials
* Power on/off: lights flicker to life or fade out with an audible/visual cue

46.5 Effects and Feedback Animation

* Selection: pulsing ground ring, outline glow, corner brackets
* Placement preview: ghost mesh with valid/invalid tint, tile highlight sweep
* Resource gain: floating numbers and small icon bursts
* Notifications: world-space markers with gentle bob and pulse
* Camera: smooth damped focus transitions, subtle impact shake for major events

46.6 Shader-Driven Animation

* Wind (global uniform driving grass, foliage, cloth, banners)
* Water (normal scroll, fresnel, depth tint)
* Dissolve/construct (placement, teleport, AI manifestation)
* Hologram/scanlines (AI interface, terminal screens, Mainframe presence)
* Heat distortion (fires, generators, hot surfaces)
* Emissive pulse (tech, alerts, AI core breathing rhythm)

46.7 Performance Rules

* Use AnimationMixer with shared clips and instancing where possible
* Cull animations off-screen; freeze distant or hidden animated objects
* Drive ambient animation (wind, water, LEDs) in shaders, not on the CPU
* Pool particles; cap simultaneous particle counts
* Never allocate per frame; reuse vectors, quaternions, and matrices

⸻

47. Audio

MVP:

* Ambient wind
* Birds
* Water
* Farming sounds
* Construction
* UI interaction
* AI notification

Music:

* Calm acoustic/ambient during daytime
* Darker ambient at night
* Electronic tones around AI facilities

⸻

48. Save System

MVP should support local save.

Use:

* IndexedDB

Save:

World state
Buildings
Tiles
Crops
Survivors
Resources
Research
AI level
AI trust
Events
Decisions
Game time

Provide:

* Save
* Load
* New Game
* Delete Save

⸻

49. Backend Strategy

MVP does not require a backend.

Architecture should allow one later.

Future backend:

Browser
   ↓
API
   ↓
Node.js / Laravel
   ↓
PostgreSQL
   ↓
Redis

Backend can later support:

* Cloud saves
* Accounts
* Multiplayer
* Persistent worlds
* AI services
* Leaderboards
* Analytics

⸻

50. Real AI Integration

Do NOT require an external LLM for the MVP.

The game should use deterministic game logic for:

* Resource calculations
* AI recommendations
* Simulation
* Research
* Events

Later, LLMs may be used for:

* Mainframe dialogue
* Dynamic explanations
* Survivor conversations
* Procedural narrative
* Personalized events

LLMs must never be authoritative for core game state.

Core game state must remain deterministic.

⸻

51. AI Architecture

Separate:

Game AI

from:

Generative AI

Game AI:

Rules
Simulation
Optimization
Decision scoring

Generative AI:

Dialogue
Narrative
Explanations
Flavor text

This prevents an LLM failure from breaking gameplay.

⸻

52. Example AI Recommendation Engine

Input:

Food = 400
Daily consumption = 90
Farm output = 60
Water = 700
Energy = 250
Population = 8

Engine calculates:

Food runway = 4.4 days

Then:

IF food runway < 5 days
THEN recommend increasing food production.

Recommendation:

Expand Farm #3.
Expected food increase:
+35/day
Expected water consumption:
+20/day
Confidence:
94%

⸻

53. AI Priority System

The Mainframe evaluates colony priorities:

Food
Water
Energy
Health
Defense
Research
Expansion

Each receives a score.

Example:

Food       92
Water      64
Energy     51
Defense    22
Research   44
Expansion  18

The highest priorities drive recommendations.

⸻

54. Colony Simulation

Each game tick updates:

* Resource production
* Consumption
* Crop growth
* Survivor needs
* Building status
* Research
* Events
* AI calculations

Simulation must be separated from rendering.

GameState
    ↓
Simulation Tick
    ↓
Updated GameState
    ↓
Renderer

⸻

55. Performance Requirements

Target:

* 60 FPS on modern desktop at 1080p
* Stable 30+ FPS on lower-end machines and integrated GPUs

Use:

* InstancedMesh for repeated geometry (tiles, props, crops, particles)
* Merged geometry and trim sheets to reduce draw calls
* Texture atlases and KTX2/Basis compressed textures
* Object pooling (particles, markers, floating text)
* Frustum culling plus occlusion culling where practical
* LOD tiers for complex assets
* Limited, pooled particle counts
* Throttled shadow map updates
* Efficient fixed-timestep simulation

Do not run expensive AI calculations every render frame.

Graphics quality presets (must exist from MVP):

* Low: no shadows or static shadows only, no SSAO, no bloom, reduced particles, lower resolution
* Medium: soft shadows, subtle bloom, reduced SSAO, moderate particles
* High: full soft shadows, SSAO, bloom, color grade, volumetric light, full particles
* Ultra: adds higher shadow resolution, DOF in cinematic shots, higher particle counts

Presets must be switchable at runtime without reloading and must degrade gracefully on unsupported hardware.

⸻

56. Game Tick Strategy

Rendering:

requestAnimationFrame

Simulation:

fixed timestep

Example:

10 simulation ticks / second

Rendering can interpolate between states.

⸻

57. Input System

Support:

* Mouse
* Keyboard
* Touch where practical

Mouse:

* Left click = select/interact
* Right click = contextual action
* Drag = camera
* Wheel = zoom

Keyboard:

WASD = camera
Space = pause
1 = normal speed
2 = fast
3 = very fast

⸻

58. Game Speed

Modes:

Pause
1x
2x
4x

AI calculations should remain deterministic regardless of rendering speed.

⸻

59. MVP Scope

The first playable version should include ONLY:

World

* One map
* Isometric rendering
* Camera
* Basic terrain

Resources

* Food
* Water
* Energy
* Wood
* Scrap
* Data
* Compute

Buildings

* Shelter
* Farm
* Water Collector
* Storage
* Workshop
* Generator
* Server Room
* AI Core

Characters

* 3–5 survivors

Farming

* 3 crops

Survival

* Food
* Water
* Energy
* Basic health

Exploration

* 3 ruin locations

Technology

* Small research tree

AI

* Sanctuary Mainframe discovery
* AI recommendations
* AI research
* AI optimization
* Basic AI trust

Narrative

* Intro
* AI discovery
* 5–10 events
* Basic ending condition

Save

* Local save/load

⸻

60. MVP Explicitly Excludes

Do NOT implement initially:

* Multiplayer
* Online accounts
* Real LLM integration
* Complex combat
* Huge procedural worlds
* Animals
* Vehicles
* Complex trading economy
* Steam integration
* Mobile builds
* Multiplayer synchronization
* Full voice acting
* Procedural dialogue generation
* Advanced weather simulation

These are future features.

⸻

61. MVP Player Journey

The first 30–60 minutes should look approximately like:

Start
 ↓
Gather wood
 ↓
Build shelter
 ↓
Collect water
 ↓
Create farm
 ↓
Plant crops
 ↓
Meet survivors
 ↓
Build workshop
 ↓
Restore generator
 ↓
Explore ruins
 ↓
Discover underground facility
 ↓
Activate Sanctuary Mainframe
 ↓
AI analyzes colony
 ↓
Unlock Data
 ↓
Build Server Room
 ↓
Generate Compute
 ↓
Use AI optimization
 ↓
End of MVP progression

The player should finish the MVP thinking:

“I want to see what happens when the Mainframe gets more powerful.”

⸻

62. First 10 Minutes

Do not expose the full technology tree.

Player sees:

Food
Water
Wood
Scrap

Objective:

Build a shelter before night.

After shelter:

Establish a food source.

After farm:

Find a source of electricity.

⸻

63. First Major Reveal

After restoring power to the ruined facility:

Screen darkens.

Old terminal activates.

SYSTEM RECOVERY
SANCTUARY MAINFRAME
STATUS: 3%
BOOTING...

Then:

Hello.
I was waiting for someone
to restore power.

This should be the game’s first major narrative hook.

⸻

64. Tutorial Philosophy

Do not use long tutorial popups.

Teach through objectives.

Instead of:

“Farms generate food. Click the farm button.”

Use:

Objective: Grow enough food to survive tomorrow.

The player discovers farming naturally.

⸻

65. Quest/Objectives System

Objectives are short.

Example:

SURVIVE
□ Build shelter
□ Collect water
□ Plant crops
□ Produce food

Later:

THE MACHINE
□ Restore power
□ Explore the facility
□ Recover the AI core
□ Activate Sanctuary Mainframe

⸻

66. Metrics

Track internally:

* Session duration
* Tutorial completion
* First farm placement
* AI discovery
* AI recommendation acceptance
* AI trust changes
* Research progression
* Return sessions

Do not prioritize monetization during the MVP.

⸻

67. Monetization Direction

Potential future model:

Premium browser game

One-time purchase.

OR:

Free core game

Optional:

* Cosmetic buildings
* Colony themes
* Additional scenarios
* Expansion packs

Avoid pay-to-win mechanics.

⸻

68. Future Multiplayer

Potential later mode:

Players operate separate colonies in the same persistent world.

Possible interactions:

* Trade
* Research sharing
* Resource agreements
* AI diplomacy
* Alliances
* Competition

This should NOT affect the single-player MVP architecture.

⸻

69. Future AI Multiplayer Concept

Each player’s Mainframe could develop differently.

Example:

Player A:

MAINFRAME:
Humanist
Low autonomy
High empathy

Player B:

MAINFRAME:
Efficiency-focused
High autonomy
Low empathy

The two colonies could negotiate through their AI systems.

This could become a unique multiplayer feature.

⸻

70. Code Architecture

The simulation must be fully decoupled from the renderer. GameState and systems know nothing about Three.js. The render/view layer reads GameState and drives the Three.js scene.

Recommended structure:

src/
├── main.ts
│
├── core/
│   ├── Game.ts                 // bootstraps simulation + view + loop
│   ├── GameConfig.ts
│   ├── Loop.ts                 // fixed-timestep sim + rAF render
│   ├── Time.ts
│   └── Events.ts               // typed event bus between systems and view
│
├── state/
│   ├── GameState.ts
│   ├── SaveSystem.ts
│   └── StateSerializer.ts
│
├── world/
│   ├── World.ts
│   ├── Tile.ts
│   ├── Terrain.ts
│   ├── Grid.ts                 // grid <-> world coordinate conversion
│   └── MapGenerator.ts
│
├── entities/
│   ├── Survivor.ts
│   ├── Building.ts
│   ├── Crop.ts
│   └── ResourceNode.ts
│
├── systems/                    // deterministic, renderer-agnostic
│   ├── SimulationSystem.ts
│   ├── ResourceSystem.ts
│   ├── FarmingSystem.ts
│   ├── SurvivalSystem.ts
│   ├── ConstructionSystem.ts
│   ├── ResearchSystem.ts
│   ├── ExplorationSystem.ts
│   └── EventSystem.ts
│
├── ai/
│   ├── Mainframe.ts
│   ├── RecommendationEngine.ts
│   ├── PredictionEngine.ts
│   ├── AutomationEngine.ts
│   └── AiState.ts
│
├── view/                       // Three.js-only layer
│   ├── View.ts                 // scene, renderer, composer orchestration
│   ├── Renderer.ts
│   ├── CameraRig.ts            // orthographic camera + controls
│   ├── Sky.ts                  // sky dome / gradient / sun position
│   ├── Lighting.ts             // sun, hemisphere, light manager
│   ├── PostFX.ts               // EffectComposer chain + presets
│   ├── Materials.ts            // shared material library
│   ├── AssetManager.ts         // GLTF/texture loading + cache
│   ├── Picker.ts               // raycast tile/entity picking
│   ├── world/
│   │   ├── TerrainView.ts
│   │   ├── BuildingView.ts
│   │   ├── CropView.ts
│   │   ├── SurvivorView.ts
│   │   └── PropView.ts
│   ├── fx/
│   │   ├── Particles.ts
│   │   ├── Weather.ts
│   │   ├── Water.ts
│   │   └── SelectionMarkers.ts
│   └── shaders/                // wind, water, dissolve, hologram, heat
│
├── input/
│   ├── InputManager.ts
│   └── Pointer.ts
│
├── data/
│   ├── crops.ts
│   ├── buildings.ts
│   ├── technologies.ts
│   ├── survivors.ts
│   └── events.ts
│
└── ui/                         // DOM overlay, no Three.js
    ├── HUD.ts
    ├── BuildMenu.ts
    ├── ResearchPanel.ts
    ├── SurvivorPanel.ts
    ├── MainframePanel.ts
    └── EventPanel.ts

Key rules:

* systems/ and ai/ never import three
* view/ never mutates GameState
* data/ is pure definitions, no logic
* ui/ is DOM-only and communicates through the event bus and commands
* Shaders are isolated and reusable across materials

⸻

71. Data-Driven Design

Buildings, crops, technologies and events should be data-driven.

Example conceptual structure:

interface BuildingDefinition {
    id: string;
    name: string;
    cost: ResourceCost;
    size: GridSize;
    production?: ProductionDefinition;
    consumption?: ResourceConsumption;
    workerSlots: number;
    unlockTechnology?: string;
}

Avoid hardcoding individual buildings into gameplay systems.

⸻

72. Game State

Central state should include:

WorldState
ResourceState
BuildingState
SurvivorState
CropState
ResearchState
AiState
EventState
TimeState
PlayerState

State should be serializable.

⸻

73. Determinism

Core simulation should be deterministic where possible.

Use seeded random generation.

Save:

world seed
random state where necessary

This enables debugging and replayable scenarios.

⸻

74. Testing

Use unit tests for:

* Resource calculations
* Crop growth
* Production
* Consumption
* Building costs
* Research requirements
* AI recommendation calculations
* Survivor needs
* Event conditions

Do not rely exclusively on visual/manual testing.

⸻

75. Error Handling

Game should gracefully handle:

* Invalid placement
* Missing resources
* Corrupt save
* Unsupported browser features
* Texture loading failures
* Audio failure

A rendering problem must not corrupt game state.

⸻

76. Accessibility

Provide:

* Keyboard controls
* Adjustable text size where practical
* High contrast UI
* Reduced motion option
* Color-independent resource indicators
* Tooltips
* Pause functionality

⸻

77. Responsive Design

Desktop is primary.

Minimum useful layout:

1280 × 720

At smaller sizes:

* Reduce HUD density
* Collapse side panels
* Keep world playable
* Avoid horizontal page overflow

⸻

78. Visual Asset Pipeline

Use a consistent, compressed, engine-ready asset specification.

Format:

* Models: glTF 2.0 (.glb), single file, Draco or Meshopt compressed
* Textures: PNG source, shipped as KTX2/Basis for GPU compression
* Animations: embedded in the .glb, or separate clip files
* Environment/lighting: optional HDRI for reflections and ambient, kept low-res and prefiltered
* UI icons: SVG or PNG atlas

Scale and units:

* 1 grid tile = 1 world unit = 1 meter
* Terrain tiles: 1 × 1 unit footprint
* Characters: ~1.7 units tall
* Buildings: 1×1, 2×2, or 3×3 footprints; height scaled to the building's real-world feel
* Props: sized to human scale for believability

Texture maps (per material, where relevant):

* BaseColor / Albedo
* Normal
* Roughness
* Metalness
* Ambient Occlusion
* Emissive (for technology)
* Optional: packed ORM (Occlusion/Roughness/Metalness) to reduce texture count

Asset budgets:

* Hero buildings: up to ~5–15k triangles
* Standard buildings: ~1–4k triangles
* Props: under ~1k triangles
* Characters: ~8–20k triangles with a shared skeleton where possible
* Texture resolution: 512–2048 depending on importance; tileable detail textures at 512–1024

Conventions:

* Y-up, meters, applied scale/rotation
* Consistent forward axis (+Z or -Z) for all characters and vehicles
* Pivot at the base center for placement
* LOD variants for hero assets (LOD0/LOD1/LOD2)
* Collision/footprint meshes authored separately or derived from the grid size
* Naming: terrain_grass_01, building_shelter_01, building_farm_01, character_farmer_idle, character_farmer_walk_01, prop_crate_01, fx_fire_01

Pipeline tooling:

* Model in Blender, export glTF
* Validate assets in a sandbox Three.js scene before integration
* Run an asset audit (tri count, texture size, material count) before merge
* Keep a manifest of all assets with budgets and owners

⸻

79. Art Production Strategy

Rich visuals do not mean a huge asset count. They mean every asset is detailed, consistent, and reused well.

MVP asset count target:

* 10 terrain material sets (grass, dirt, water, stone, forest floor, ruins, road, mud, sand, ash)
* 8 hero buildings (shelter, farm, water collector, storage, workshop, generator, server room, AI core)
* 3 crop types with 5 growth stages each
* 5 survivor characters with shared rig + animation set
* 6 shared props (crate, barrel, tarp, campfire, scrap pile, lamp)
* 5 resource icons
* 10 environmental decorations
* 10 UI icons
* Core FX (fire, smoke, dust, water, sparks, bloom-ready emissive)

Reuse strategy:

* Trim sheets and shared material libraries so many props share one texture set
* Modular building kits (walls, roofs, doors, vents) assembled into many structures
* A shared character rig with swappable clothing/gear to create many survivors from one skeleton
* Vertex-color and decal variation to make reused assets feel unique

Rule: expand the art set only after the core loop is proven fun, but never ship graybox. The MVP must be visually complete and cohesive even if the asset count is small.

⸻

80. Visual Polish Priority

Prioritize:

1. Strong silhouette — every object identifiable by outline
2. Clear depth — occlusion, contact shadows, atmospheric perspective
3. Character readability — poses, color, scale
4. Lighting and time of day — the biggest single driver of richness
5. Material quality — roughness/metalness/normal/emissive on everything
6. Animation — character, environment, and tech motion
7. Environmental movement — wind, water, smoke, particles
8. Atmosphere — fog, god rays, weather
9. Post-processing — bloom, SSAO, color grade, vignette
10. UI polish — restrained, legible, secondary to the world

Do not prioritize ultra-high-resolution assets or photoreal fidelity before the world is cohesive and readable. Richness comes from lighting, materials, motion, and detail density — not raw texture resolution.

⸻

81. Sound Design Priority

Important feedback sounds:

* Build complete
* Resource collected
* Crop harvested
* Research complete
* AI message
* Warning
* Event decision
* Discovery

Audio should communicate game state.

⸻

82. Performance Budget

Avoid:

* Thousands of individual non-instanced meshes
* Per-frame expensive calculations or allocations
* Unbounded particles or unbounded real-time lights
* Recreating UI or rebuilding scene graph every frame
* Per-frame shadow map renders for many lights
* Full-resolution post-processing on low-end hardware

Prefer:

* Instanced and merged geometry
* Event-driven updates
* Object pools
* Batched rendering and shared materials
* Fixed simulation ticks
* Throttled shadows and culled local lights
* Resolution scaling for the post-processing chain

Target budgets (High preset, 1080p):

* Draw calls: under ~300
* Triangles on screen: under ~1.5M
* Real-time shadow-casting lights: 1 (sun) + up to 2 key local lights
* Total dynamic lights: under ~12
* Active particle systems: under ~20
* Post-processing passes: under ~6

These are guidelines to protect the 60 FPS target, not hard limits; measure on real hardware.

⸻

83. Development Milestones

Milestone 0 — Visual Foundation

* Three.js + Vite + TypeScript setup
* Orthographic isometric camera rig with pan/zoom/bounds
* Renderer config (tone mapping, shadows, color space)
* Post-processing chain with quality presets
* Sky + sun + hemisphere lighting + day/night cycle
* One fully art-passed terrain tile set and one hero building
* Confirms the target look before systems are built

Milestone 1 — Rendering and World

* Isometric 3D grid and terrain
* Materials library and asset manager (GLTF + KTX2)
* Instanced tiles and props
* Camera focus transitions
* Character movement with skeletal animation
* Picking/raycast selection

Milestone 2 — World Interaction

* Selection
* Tile interaction
* Building placement with ghost preview and validity tint
* Resource nodes

Milestone 3 — Survival

* Resources
* Consumption
* Time
* Farming (with growth-stage visuals and wind/water FX)

Milestone 4 — Colony

* Survivors
* Jobs
* Buildings
* Production

Milestone 5 — Technology

* Research
* Data
* Compute
* Server building

Milestone 6 — Sanctuary Mainframe

* AI discovery (cinematic reveal with the signature color and lighting shift)
* Recommendation engine
* AI panel
* AI upgrades
* AI core FX and atmosphere

Milestone 7 — Narrative

* Events
* Decisions
* Trust
* Intro
* MVP ending

Milestone 8 — Visual Polish and Atmosphere

* Weather (rain, wet surfaces, fog, ash)
* Volumetric light and god rays
* Expanded particle FX
* Full animation pass (environment, tech, characters)
* Lighting and color-grade tuning per game stage
* LOD and performance optimization across presets
* UI polish
* Audio
* Save/load

⸻

84. Definition of Done — MVP

The MVP is complete when a new player can:

1. Start a new game.
2. Move around the isometric world.
3. Gather resources.
4. Build a shelter.
5. Build and operate a farm.
6. Grow and harvest crops.
7. Manage food and water.
8. Recruit/manage several survivors.
9. Build basic infrastructure.
10. Restore electricity.
11. Explore ruins.
12. Discover Sanctuary Mainframe.
13. Generate Data and Compute.
14. Use Mainframe recommendations.
15. Research several technologies.
16. Experience meaningful AI-related decisions.
17. Reach the first narrative conclusion.
18. Save and reload the game.

The MVP is visually complete when:

1. The world is fully art-passed — no graybox or untextured surfaces.
2. The day/night cycle visibly changes lighting, shadows, and mood.
3. Every building has a strong silhouette, real materials, and micro-detail.
4. Characters are skinned, animated, and read clearly at the isometric angle.
5. Atmosphere is present — fog, particles, and environmental motion.
6. The Mainframe introduces a distinct visual and lighting signature.
7. The game holds 60 FPS on a modern desktop at the High preset.
8. Quality presets degrade gracefully on lower-end hardware.

⸻

85. Success Criteria

The MVP should answer three questions:

Question 1

Is the survival/farming loop enjoyable?

Question 2

Is colony progression satisfying?

Question 3

Does the Sanctuary Mainframe create enough curiosity that players want to continue?

If the answer to #3 is yes, the project has a strong foundation.

⸻

86. Long-Term Vision

The ultimate game should evolve from:

Tiny Farm

into:

Human Settlement

into:

Technological Colony

into:

AI Civilization

The player should eventually look back at the original farm and realize:

The tiny settlement they started with has become an entirely new civilization.

The central gameplay tension remains:

                 HUMANITY
                    │
          ┌─────────┴─────────┐
          │                   │
      SURVIVAL             PROGRESS
          │                   │
          └─────────┬─────────┘
                    │
            SANCTUARY MAINFRAME
                    │
          ┌─────────┴─────────┐
          │                   │
       ASSISTANCE          AUTONOMY
          │                   │
          └─────────┬─────────┘
                    │
                PLAYER'S
                 CHOICE

⸻

87. Product Principle

The game should never be “an AI game” simply because it contains an AI character.

The AI must fundamentally change how the player approaches:

* Farming
* Resources
* Technology
* Colony management
* Exploration
* Risk
* Morality
* Progression

The player should eventually ask:

“Am I rebuilding civilization, or am I building the world that the Mainframe wants?”

That is the core identity of the game.

I would not build the entire PRD above in one pass with an AI coding agent. Use it as the product north star, then create a much smaller MVP-spec.md from sections 59–63, 70–73, and 83–84 and build that first. That keeps the project from turning into an unfinishable colony-sim monster.