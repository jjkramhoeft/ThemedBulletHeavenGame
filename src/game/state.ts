import type Phaser from 'phaser';
import type { RunState } from './rules/run';
import type { PrefsV1, SaveV1 } from './rules/save';
import type { ThemeContext } from './theme/ThemeContext';
import type { ThemeManifest } from './theme/ThemeManifest';

// Typed access to the game-wide registry shared by all scenes.
const THEME = 'theme', MANIFESTS = 'manifests', SAVE = 'save', PREFS = 'prefs', RUN = 'run';

type WithRegistry = { registry: Phaser.Data.DataManager };

export const getTheme = (s: WithRegistry) => s.registry.get(THEME) as ThemeContext;
export const setTheme = (s: WithRegistry, t: ThemeContext) => s.registry.set(THEME, t);
export const getManifests = (s: WithRegistry) => s.registry.get(MANIFESTS) as ThemeManifest[];
export const setManifests = (s: WithRegistry, m: ThemeManifest[]) => s.registry.set(MANIFESTS, m);
export const getSave = (s: WithRegistry) => s.registry.get(SAVE) as SaveV1;
export const setSave = (s: WithRegistry, v: SaveV1) => s.registry.set(SAVE, v);
export const getPrefs = (s: WithRegistry) => s.registry.get(PREFS) as PrefsV1;
export const setPrefs = (s: WithRegistry, v: PrefsV1) => s.registry.set(PREFS, v);
export const getRun = (s: WithRegistry) => s.registry.get(RUN) as RunState | undefined;
export const setRun = (s: WithRegistry, r: RunState) => s.registry.set(RUN, r);
