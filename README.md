# Null Orbit

This project is a browser-based 3D game built with `Three.js` and `Vite`.

The repo already contains:

- A game runtime in `src/main.js`
- A current map editor in `src/editor.js`
- A map data format in `src/mapData.js`
- Reusable GLB assets in `public/models`

That means the shortest path to a Unity-like workflow is not to start over in another language or engine. The best next step is to evolve the current browser editor into a true 3D in-engine editor that reuses the same runtime concepts as the game.

## Recommended Direction

Build the editor in `TypeScript + Three.js + browser UI`.

Why this is the best fit for this project:

- It reuses the current game code directly.
- It runs well on a MacBook Air.
- It avoids rebuilding rendering, camera logic, asset loading, and map serialization in a different stack.
- It gives fast iteration during development.
- If a desktop app is still desirable later, the browser editor can be packaged with `Tauri`.

Recommended approach:

- Browser-first editor
- Shared data and rendering logic with the game
- Desktop packaging later only if needed

## Why Not Start With a Native Editor

Starting over in `C#`, `C++`, `Rust`, `Swift`, or another native stack would add a lot of work before getting useful features.

That path would require rebuilding:

- Rendering setup
- Editor camera and navigation
- Selection and transform tools
- Asset loading
- Map save/load
- UI panels
- Game/editor data interchange

For this repo, that cost is not justified yet because the game already uses `Three.js`.

## Editor Goal

The target is a lightweight Unity-like tool for this game:

- Open a dedicated editor app/page
- View the map in 3D
- Fly or orbit around the level
- Select objects
- Move, rotate, and eventually scale them
- Place prefab instances
- Edit object properties in an inspector
- Save and reload the current map quickly
- Launch the game with the current map for fast playtesting

## Recommended Architecture

Use one shared data model and two runtimes:

- `game runtime`
- `editor runtime`

Both should rely on:

- Shared scene data
- Shared prefab definitions
- Shared model loading
- Shared world-building rules

The editor should not be a completely separate system. It should reuse as much of the existing game logic and data shape as possible.

## Data Model Strategy

The current format in `src/mapData.js` is already useful and should continue to work. However, the editor should gradually move toward an internal normalized scene format.

Suggested internal structure:

```ts
type SceneEntity = {
  id: string;
  type: string;
  prefabId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  size?: { w: number; h: number; d?: number };
  props?: Record<string, unknown>;
};
```

Short-term plan:

- Keep loading the current map format
- Convert it into normalized editor entities internally
- Edit in the normalized structure
- Serialize back to the current map format

This keeps backward compatibility while making the editor much easier to grow.

## Prefab Strategy

Do not try to build a full Unity-style prefab system on day one.

A good first version of prefabs is:

- A `prefabId`
- A model reference
- Default size / placement rules
- Default gameplay properties
- Optional editor metadata like icon, tint, or label

Suggested examples:

- `player`
- `base`
- `enemyBase`
- `obstacle`
- `bomb`
- Later: turrets, spawn markers, triggers, pickups, wave markers

For art creation and mesh editing, use `Blender`.

For gameplay placement and configuration, use the custom editor.

That split is much cheaper and more practical than trying to turn the custom editor into a full DCC tool.

## Browser vs Desktop

Browser-first is the recommended path.

Benefits:

- Reuses the current project directly
- Fastest implementation path
- Easy iteration and debugging
- Good enough performance for this scale
- No extra packaging complexity while features are still changing

Desktop can come later through `Tauri` if needed.

That gives:

- A real app window
- A dock icon
- Native-feeling launch behavior
- The same web-based editor code underneath

## Concrete Milestone Roadmap

### 1. Make the Current Data Model Editor-Friendly

Keep the existing fields:

- `playerStart`
- `basePosition`
- `enemyBasePosition`
- `obstacles`
- `bombs`

Add an internal normalized representation such as:

- `entities: [{ id, type, position, rotation, size, prefabId, props }]`

The editor can keep saving the current map structure at first, but should work internally with one consistent entity model.

### 2. Extract World-Building From the Game

`src/main.js` currently does a lot of scene construction inline.

Refactor shared world-building into reusable modules so both the game and the editor can:

- Instantiate objects from map data
- Apply prefab defaults
- Load models consistently
- Stay visually in sync

This is one of the highest-value refactors because it prevents drift between the game and the editor.

### 3. Build a Real 3D Editor Viewport

Replace the current flat DOM grid editor in `editor.html` and `src/editor.js` with a Three.js-based viewport.

First viewport features:

- Ground grid
- 3D scene rendering
- Mouse raycasting onto the ground
- Orbit camera
- Pan
- Zoom
- Top-down view toggle

The user should be able to move around the level visually instead of editing only a 2D grid.

### 4. Add Selection and Transform Tools

After the viewport works:

- Click an object to select it
- Highlight the selected object
- Show a transform gizmo
- Start with `move`
- Add `rotate`
- Add `scale` only if it is actually useful for gameplay objects

This is what will make the tool feel much closer to Unity.

### 5. Add Prefab Placement

Create a left-side prefab palette:

- Click a prefab type
- Enter placement mode
- Click on the ground to place it

Placement should support:

- Snap-to-grid placement
- Preview ghost before placing
- Object-specific placement constraints

### 6. Add Inspector and Hierarchy Panels

The right-side inspector should show properties for the selected object:

- Position
- Rotation
- Type
- Prefab ID
- Size
- Gameplay properties

A scene list or simple hierarchy panel can show all placed entities.

The first version does not need to be complex. A flat scene object list is enough.

### 7. Add Save / Load / Playtest Loop

Keep the current `localStorage` save behavior initially.

Then add:

- Save current editor scene
- Reload current editor scene
- Reset to default map
- Play current map in the normal game

The ideal workflow is:

1. Place or move objects
2. Save
3. Press play
4. Test immediately

That fast loop is one of the main benefits of a custom in-project editor.

### 8. Add Quality-of-Life Features

Once the basics work, add:

- Duplicate selected object
- Delete selected object
- Box select
- Multi-select
- Undo / redo
- Focus selected
- Rotation snapping
- Toggle grid snapping
- Top-down / orbit camera switch

These can come after the editor is already useful.

### 9. Package as Desktop Only When the Browser Version Feels Good

If the browser editor becomes stable and enjoyable to use, package it with `Tauri`.

That gives a standalone Mac app without needing to rewrite the tool in a native UI stack.

## Suggested Modules and Files

Keep the current files working and add new modules around them.

Suggested structure:

- `src/editor/index.ts`
  Editor entry point
- `src/editor/EditorApp.ts`
  Main coordinator for editor systems
- `src/editor/EditorViewport.ts`
  Renderer, scene, raycasting, resize, render loop
- `src/editor/EditorCameraController.ts`
  Orbit/pan/zoom and camera mode management
- `src/editor/EditorSceneBuilder.ts`
  Builds the visible editor scene from map data
- `src/editor/SelectionManager.ts`
  Selection and hover tracking
- `src/editor/TransformTool.ts`
  Move/rotate/scale gizmo logic
- `src/editor/PlacementTool.ts`
  Handles prefab placement on the ground
- `src/editor/GridSnap.ts`
  Grid and world coordinate conversion
- `src/editor/EditorStore.ts`
  Central editor state container
- `src/editor/ui/InspectorPanel.ts`
  Right sidebar inspector UI
- `src/editor/ui/PrefabPalette.ts`
  Left sidebar placement palette
- `src/editor/ui/Toolbar.ts`
  Tool buttons and common actions
- `src/shared/scene/SceneTypes.ts`
  Scene and entity type definitions
- `src/shared/scene/SceneSerializer.ts`
  Converts between editor data and current map data
- `src/shared/scene/PrefabRegistry.ts`
  Central prefab definitions
- `src/shared/scene/WorldFactory.ts`
  Shared map-to-scene building logic
- `src/shared/scene/ModelCache.ts`
  Shared model loading and reuse

## Core Class Responsibilities

These are the first modules worth designing carefully:

- `EditorApp`
  Boots the editor and wires all systems together
- `EditorStore`
  Tracks selected object, active tool, active prefab, undo state, and dirty state
- `PrefabRegistry`
  Defines what can be placed and how it should behave
- `SceneSerializer`
  Preserves compatibility with the current `mapData` format
- `WorldFactory`
  Ensures the editor and game instantiate objects consistently
- `SelectionManager`
  Supports most editor interactions
- `PlacementTool`
  Enables object placement from the palette
- `TransformTool`
  Enables move/rotate/scale interactions

## What Should Be Reused From the Current Repo

The new editor should build on these existing pieces:

- `src/main.js`
  Rendering setup, scene conventions, asset loading patterns
- `src/editor.js`
  Existing edit workflow concepts and world/grid conversion logic
- `src/mapData.js`
  Persistence and current level schema
- `src/paths.js`
  Asset and model path helpers
- `public/models/*.glb`
  Existing prefab visuals

## What Should Not Be Built Yet

Avoid these early on:

- Full nested prefab override system
- Terrain sculpting
- Animation timeline editing
- Material/shader authoring
- A custom native desktop UI stack
- A Unity-scale asset database

Those features are expensive and are not necessary to get a very useful editor for this game.

## Practical Development Order

If implementing this incrementally, use this order:

1. Extract shared scene/map helpers from `src/main.js`
2. Define `PrefabRegistry` and `SceneSerializer`
3. Create `src/editor/index.ts` and a basic Three.js editor viewport
4. Render the current map in 3D
5. Add click-to-select
6. Add place-object-on-ground
7. Add move selected object
8. Save and load through the current map format
9. Add a playtest button that launches the game with the current map

At that point, the editor should already be genuinely useful.

## Realistic First Two Weeks

Suggested short-term implementation sequence:

### Week 1

- Extract shared map/scene construction logic
- Create scene entity types
- Add prefab registry
- Build basic editor viewport
- Render the current map in the editor

### Week 2

- Add object selection
- Add placement mode
- Add move tool
- Add inspector panel
- Add save/load loop
- Add playtest button

By the end of that, the project should have a practical 3D editing workflow without requiring a full engine rewrite.

## Final Recommendation

For this project:

- Build the editor in the browser
- Use `TypeScript + Three.js`
- Reuse the current game systems
- Use `Blender` for mesh authoring
- Use the custom editor for gameplay layout and prefab placement
- Package with `Tauri` later only if needed

This is the shortest, safest, and most scalable path to a Unity-like editing workflow for `null-orbit`.
