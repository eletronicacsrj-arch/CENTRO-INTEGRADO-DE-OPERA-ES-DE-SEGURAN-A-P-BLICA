import { Incident, GroupName, Message, SyncPayload, IncidentStatus, GROUPS, INCIDENT_CATEGORIES, Central } from '../types';

// --- CENTRAL CONFIGURATION & MULTI-TENANCY ---

// Key to store the list of available centrals (Global)
const KEY_CENTRALS_REGISTRY = 'ciosp_global_registry';
// Key to store which central is currently active (Global)
const KEY_ACTIVE_CENTRAL_ID = 'ciosp_active_central_id';

let CURRENT_CENTRAL_ID = localStorage.getItem(KEY_ACTIVE_CENTRAL_ID) || 'DEFAULT';

// Dynamic Key Generator: Prefixes all keys with the Current Central ID to isolate data
const getKey = (key: string) => `ciosp_${CURRENT_CENTRAL_ID}_${key}`;

// --- Central Management Functions ---

export const getAvailableCentrals = (): Central[] => {
    try {
        const data = localStorage.getItem(KEY_CENTRALS_REGISTRY);
        if (!data) {
            // Initialize with Default
            const defaults: Central[] = [{ id: 'DEFAULT', name: 'CENTRAL PRINCIPAL', password: '' }];
            localStorage.setItem(KEY_CENTRALS_REGISTRY, JSON.stringify(defaults));
            return defaults;
        }
        return JSON.parse(data);
    } catch (e) {
        return [{ id: 'DEFAULT', name: 'CENTRAL PRINCIPAL', password: '' }];
    }
};

export const createCentral = (name: string, password?: string): boolean => {
    const list = getAvailableCentrals();
    // Generate safe ID
    const id = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    
    if (list.find(c => c.name.toUpperCase() === name.toUpperCase())) return false; // Duplicate name

    const newCentral: Central = { id, name, password };
    list.push(newCentral);
    localStorage.setItem(KEY_CENTRALS_REGISTRY, JSON.stringify(list));
    return true;
};

export const deleteCentral = (id: string) => {
    if (id === 'DEFAULT') return; // Protect default
    const list = getAvailableCentrals();
    const updated = list.filter(c => c.id !== id);
    localStorage.setItem(KEY_CENTRALS_REGISTRY, JSON.stringify(updated));

    // Cleanup Data for this Central
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`ciosp_${id}_`)) {
            localStorage.removeItem(key);
        }
    });

    // If we deleted the active one, switch to default
    if (CURRENT_CENTRAL_ID === id) {
        setActiveCentral('DEFAULT');
    }
};

export const setActiveCentral = (id: string) => {
    CURRENT_CENTRAL_ID = id;
    localStorage.setItem(KEY_ACTIVE_CENTRAL_ID, id);
    // Reload page to ensure clean state for everything
    window.location.reload(); 
};

export const getActiveCentralInfo = (): Central => {
    const list = getAvailableCentrals();
    return list.find(c => c.id === CURRENT_CENTRAL_ID) || { id: 'DEFAULT', name: 'CENTRAL PRINCIPAL' };
};

// --- DATA STORAGE FUNCTIONS (Scoped to Current Central) ---

// Base Keys (Suffixes)
const KEY_INCIDENTS = 'incidents';
const KEY_ICONS = 'icons';
const KEY_SOUNDS = 'sounds';
const KEY_MESSAGES = 'messages';
const KEY_WATERMARK = 'watermark';
const KEY_NAMES = 'custom_names';
const KEY_EMAIL = 'backup_email';
const KEY_TITLE = 'app_title';
const KEY_COMMAND_LABEL = 'command_label';
const KEY_CREST_LEFT = 'crest_left';
const KEY_CREST_RIGHT = 'crest_right';
const KEY_GROUP_ORDER = 'group_order';
const KEY_CATEGORIES = 'custom_categories';


// Simulate a database using LocalStorage
export const getStoredIncidents = (): Incident[] => {
  try {
    const data = localStorage.getItem(getKey(KEY_INCIDENTS));
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading incidents", e);
    return [];
  }
};

export const saveIncident = (incident: Incident) => {
  const current = getStoredIncidents();
  // Check if update or new
  const index = current.findIndex(i => i.id === incident.id);
  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = incident;
  } else {
    updated = [incident, ...current];
  }
  localStorage.setItem(getKey(KEY_INCIDENTS), JSON.stringify(updated));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const deleteIncident = (id: string) => {
  const current = getStoredIncidents();
  const updated = current.filter(i => i.id !== id);
  localStorage.setItem(getKey(KEY_INCIDENTS), JSON.stringify(updated));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const clearResolvedIncidents = () => {
  const current = getStoredIncidents();
  // Keep only PENDING and ACKNOWLEDGED incidents
  const updated = current.filter(i => 
    i.status === IncidentStatus.PENDING || 
    i.status === IncidentStatus.ACKNOWLEDGED
  );
  localStorage.setItem(getKey(KEY_INCIDENTS), JSON.stringify(updated));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getStoredIcons = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(getKey(KEY_ICONS));
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const saveStoredIcon = (group: string, base64: string) => {
  const icons = getStoredIcons();
  icons[group] = base64;
  localStorage.setItem(getKey(KEY_ICONS), JSON.stringify(icons));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getStoredSounds = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(getKey(KEY_SOUNDS));
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const saveStoredSound = (group: string, base64: string) => {
  const sounds = getStoredSounds();
  sounds[group] = base64;
  localStorage.setItem(getKey(KEY_SOUNDS), JSON.stringify(sounds));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getStoredNames = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(getKey(KEY_NAMES));
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const saveStoredName = (originalGroup: string, newName: string) => {
  const names = getStoredNames();
  names[originalGroup] = newName;
  localStorage.setItem(getKey(KEY_NAMES), JSON.stringify(names));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getStoredCategories = (): Record<string, string[]> => {
  try {
    const data = localStorage.getItem(getKey(KEY_CATEGORIES));
    return data ? JSON.parse(data) : INCIDENT_CATEGORIES;
  } catch (e) {
    return INCIDENT_CATEGORIES;
  }
};

export const saveStoredCategories = (cats: Record<string, string[]>) => {
  localStorage.setItem(getKey(KEY_CATEGORIES), JSON.stringify(cats));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getStoredMessages = (): Message[] => {
  try {
    const data = localStorage.getItem(getKey(KEY_MESSAGES));
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveMessage = (message: Message) => {
  const current = getStoredMessages();
  // Prevent duplicates
  if (current.some(m => m.id === message.id)) return;
  
  const updated = [message, ...current];
  localStorage.setItem(getKey(KEY_MESSAGES), JSON.stringify(updated));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const deleteMessage = (id: string) => {
  const current = getStoredMessages();
  const updated = current.filter(m => m.id !== id);
  localStorage.setItem(getKey(KEY_MESSAGES), JSON.stringify(updated));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getWatermark = (): string | null => {
  return localStorage.getItem(getKey(KEY_WATERMARK));
}

export const saveWatermark = (base64: string) => {
  localStorage.setItem(getKey(KEY_WATERMARK), base64);
  window.dispatchEvent(new Event('local-storage-update'));
}

export const getStoredEmail = (): string => {
  return localStorage.getItem(getKey(KEY_EMAIL)) || "";
}

export const saveStoredEmail = (email: string) => {
  localStorage.setItem(getKey(KEY_EMAIL), email);
}

export const getStoredTitle = (): string => {
  return localStorage.getItem(getKey(KEY_TITLE)) || "CIOSP SECURITY";
}

export const saveStoredTitle = (title: string) => {
  localStorage.setItem(getKey(KEY_TITLE), title);
  window.dispatchEvent(new Event('local-storage-update'));
}

export const getStoredCommandLabel = (): string => {
  return localStorage.getItem(getKey(KEY_COMMAND_LABEL)) || "CENTRAL DE COMANDO";
}

export const saveStoredCommandLabel = (label: string) => {
  localStorage.setItem(getKey(KEY_COMMAND_LABEL), label);
  window.dispatchEvent(new Event('local-storage-update'));
}

export const getStoredCrestLeft = (): string | null => {
  return localStorage.getItem(getKey(KEY_CREST_LEFT));
}

export const saveStoredCrestLeft = (base64: string) => {
  localStorage.setItem(getKey(KEY_CREST_LEFT), base64);
  window.dispatchEvent(new Event('local-storage-update'));
}

export const getStoredCrestRight = (): string | null => {
  return localStorage.getItem(getKey(KEY_CREST_RIGHT));
}

export const saveStoredCrestRight = (base64: string) => {
  localStorage.setItem(getKey(KEY_CREST_RIGHT), base64);
  window.dispatchEvent(new Event('local-storage-update'));
}

export const getStoredGroupOrder = (): string[] => {
    try {
        const data = localStorage.getItem(getKey(KEY_GROUP_ORDER));
        if (data) {
            const parsed = JSON.parse(data);
            const allGroups = GROUPS;
            const merged = [...new Set([...parsed, ...allGroups])];
            return merged.filter(g => allGroups.includes(g as any));
        }
        return GROUPS;
    } catch (e) {
        return GROUPS;
    }
}

export const saveStoredGroupOrder = (order: string[]) => {
    localStorage.setItem(getKey(KEY_GROUP_ORDER), JSON.stringify(order));
    window.dispatchEvent(new Event('local-storage-update'));
}

// Client Sync Function: Overwrites local data with Server data
export const bulkUpdateFromSync = (payload: SyncPayload) => {
  localStorage.setItem(getKey(KEY_INCIDENTS), JSON.stringify(payload.incidents));
  localStorage.setItem(getKey(KEY_MESSAGES), JSON.stringify(payload.messages));
  localStorage.setItem(getKey(KEY_ICONS), JSON.stringify(payload.icons));
  localStorage.setItem(getKey(KEY_SOUNDS), JSON.stringify(payload.sounds));
  localStorage.setItem(getKey(KEY_NAMES), JSON.stringify(payload.customNames || {}));
  
  if (payload.customCategories) {
    localStorage.setItem(getKey(KEY_CATEGORIES), JSON.stringify(payload.customCategories));
  }
  
  if (payload.watermark) {
      localStorage.setItem(getKey(KEY_WATERMARK), payload.watermark);
  } else {
      localStorage.removeItem(getKey(KEY_WATERMARK));
  }

  if (payload.appTitle) {
      localStorage.setItem(getKey(KEY_TITLE), payload.appTitle);
  }

  if (payload.commandLabel) {
    localStorage.setItem(getKey(KEY_COMMAND_LABEL), payload.commandLabel);
  }

  if (payload.crestLeft) localStorage.setItem(getKey(KEY_CREST_LEFT), payload.crestLeft);
  else localStorage.removeItem(getKey(KEY_CREST_LEFT));

  if (payload.crestRight) localStorage.setItem(getKey(KEY_CREST_RIGHT), payload.crestRight);
  else localStorage.removeItem(getKey(KEY_CREST_RIGHT));

  window.dispatchEvent(new Event('local-storage-update'));
};

export const getAllData = (): SyncPayload => {
    return {
        incidents: getStoredIncidents(),
        messages: getStoredMessages(),
        icons: getStoredIcons(),
        sounds: getStoredSounds(),
        watermark: getWatermark(),
        customNames: getStoredNames(),
        appTitle: getStoredTitle(),
        commandLabel: getStoredCommandLabel(),
        crestLeft: getStoredCrestLeft(),
        crestRight: getStoredCrestRight(),
        customCategories: getStoredCategories()
    }
}

export const clearAllData = () => {
    // Only clears data for the CURRENT central
    const prefix = `ciosp_${CURRENT_CENTRAL_ID}_`;
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
        }
    });
    window.location.reload();
}