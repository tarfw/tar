/**
 * Slot extraction — regex + entity lookup for text matching.
 * No LLM needed on replay.
 */

export interface SlotDefinition {
  key: string;
  label: string;
  type: string;
}

/**
 * Extract slot values from user input text.
 * Pure regex + lookup. No LLM call.
 */
export function extractSlots(
  text: string,
  slotDefs: SlotDefinition[],
  context: {
    products?: string[];
    people?: string[];
    locations?: string[];
  } = {}
): Record<string, any> {
  const results: Record<string, any> = {};

  for (const slot of slotDefs) {
    const value = extractSlotValue(text, slot, context);
    if (value !== null) {
      results[slot.key] = value;
    }
  }

  return results;
}

function extractSlotValue(
  text: string,
  slot: SlotDefinition,
  context: { products?: string[]; people?: string[]; locations?: string[] }
): any {
  const lower = text.toLowerCase();

  switch (slot.type) {
    case 'number': {
      const match = text.match(/\b(\d+(?:\.\d+)?)\b/);
      return match ? parseFloat(match[1]) : null;
    }

    case 'date': {
      if (lower.includes('today')) return new Date().toISOString().split('T')[0];
      if (lower.includes('tomorrow')) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      }
      const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      return dateMatch ? dateMatch[1] : null;
    }

    case 'phone': {
      const phoneMatch = text.match(/\b(\+?\d{10,12})\b/);
      return phoneMatch ? phoneMatch[1] : null;
    }

    case 'email': {
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      return emailMatch ? emailMatch[0] : null;
    }

    case 'product': {
      if (context.products) {
        for (const product of context.products) {
          if (lower.includes(product.toLowerCase())) {
            return product;
          }
        }
      }
      return null;
    }

    case 'person': {
      if (context.people) {
        for (const person of context.people) {
          if (lower.includes(person.toLowerCase())) {
            return person;
          }
        }
      }
      return null;
    }

    case 'location': {
      if (context.locations) {
        for (const location of context.locations) {
          if (lower.includes(location.toLowerCase())) {
            return location;
          }
        }
      }
      return null;
    }

    case 'text':
    default: {
      // For text slots, try to extract after the label
      const labelPattern = new RegExp(`${slot.label.toLowerCase()}\\s+(.+?)(?:\\s*\\||$)`, 'i');
      const match = text.match(labelPattern);
      return match ? match[1].trim() : null;
    }
  }
}
