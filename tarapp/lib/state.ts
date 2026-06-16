// Simple shared state for the active matter
export let activeMatterId: string | null = null;

export const setActiveMatterId = (id: string | null) => {
  activeMatterId = id;
};
