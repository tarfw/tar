// Simple shared state for the active mass
export let activeMassId: string | null = null;

export const setActiveMassId = (id: string | null) => {
  activeMassId = id;
};
