import { Liquid } from 'liquidjs';

const engine = new Liquid({
  jsTruthy: true,
  strictFilters: false,
  strictVariables: false,
});

// Register passthrough 'id' filter so Braze's `| id: '...'` doesn't error
engine.registerFilter('id', (v: unknown) => v);

export type ContentBlockMap = Record<string, string>;

/**
 * Replace Braze content block includes with actual HTML.
 * Matches patterns like: {{content_blocks.${email_hero_without_cta} | id: 'cb1'}}
 */
function replaceContentBlocks(template: string, blocks: ContentBlockMap): string {
  return template.replace(
    /\{\{content_blocks\.\$\{([^}]+)\}[^}]*\}\}/g,
    (match, blockName: string) => {
      const trimmed = blockName.trim();
      return blocks[trimmed] ?? match;
    }
  );
}

/**
 * Pre-process Braze-specific Liquid syntax into standard Liquid.
 * Braze uses `${...}` inside tags, e.g.:
 *   {{canvas_entry_properties.${email_title}}}
 *   {{custom_attribute.${All Time Net Deposits}}}
 * We convert these to standard dot-notation:
 *   {{canvas_entry_properties.email_title}}
 *   {{custom_attribute["All Time Net Deposits"]}}
 */
function preprocessBraze(template: string): string {
  // First convert ${key} to standard notation so triple-brace patterns resolve correctly
  let result = template.replace(
    /\$\{([^}]+)\}/g,
    (_, key: string) => {
      if (/\s/.test(key)) {
        return `["${key}"]`;
      }
      return key;
    }
  );

  // Strip nested {{ }} inside {% %} tags (Braze allows this, LiquidJS does not)
  // First handle quoted patterns: '{{expr}}' or "{{expr}}" → just expr (unquoted, so Liquid evaluates it)
  result = result.replace(
    /\{%([^%]*?)(['"])\{\{([^}]*?)\}\}\2([^%]*?)%\}/g,
    (_, before, _quote, inner, after) => `{%${before}${inner.trim()}${after}%}`
  );
  // Then handle unquoted nested {{ }} inside {% %}
  result = result.replace(
    /\{%([^%]*?)\{\{([^}]*?)\}\}([^%]*?)%\}/g,
    (_, before, inner, after) => `{%${before}${inner.trim()}${after}%}`
  );
  // Apply repeatedly in case of multiple nested tags in one block
  while (/\{%[^%]*?\{\{[^}]*?\}\}[^%]*?%\}/.test(result) || /\{%[^%]*?['"]\{\{[^}]*?\}\}['"][^%]*?%\}/.test(result)) {
    result = result.replace(
      /\{%([^%]*?)(['"])\{\{([^}]*?)\}\}\2([^%]*?)%\}/g,
      (_, before, _quote, inner, after) => `{%${before}${inner.trim()}${after}%}`
    );
    result = result.replace(
      /\{%([^%]*?)\{\{([^}]*?)\}\}([^%]*?)%\}/g,
      (_, before, inner, after) => `{%${before}${inner.trim()}${after}%}`
    );
  }
  return result;
}

export interface LiquidContext {
  first_name: string;
  canvas_entry_properties: Record<string, string>;
  custom_attribute: Record<string, string>;
  [key: string]: unknown;
}

export function extractAssignStatements(template: string): string {
  const regex = /\{%-?\s*assign\s+[^%]+%\}|\{%-?\s*capture\s+[^%]+%\}[\s\S]*?\{%-?\s*endcapture\s*-?%\}/g;
  const matches = preprocessBraze(template).match(regex);
  return matches ? matches.join('\n') : '';
}

export async function renderLiquid(
  template: string,
  context: LiquidContext,
  contentBlocks?: ContentBlockMap
): Promise<string> {
  let processed = template;
  if (contentBlocks) {
    processed = replaceContentBlocks(processed, contentBlocks);
  }
  processed = preprocessBraze(processed);
  // Extract assign/capture statements before the first pass so we can replay them in a second pass
  const assignPrefix = extractAssignStatements(template);
  const firstPass = await engine.parseAndRender(processed, context);
  if (firstPass.includes('{{') || firstPass.includes('{%')) {
    const secondInput = assignPrefix ? `${assignPrefix}\n${firstPass}` : firstPass;
    return engine.parseAndRender(preprocessBraze(secondInput), context);
  }
  return firstPass;
}

export async function renderLiquidText(
  text: string,
  context: LiquidContext,
  assignPrefix?: string
): Promise<string> {
  if (!text) return '';
  const fullText = assignPrefix ? `${assignPrefix}\n${text}` : text;
  const processed = preprocessBraze(fullText);
  return engine.parseAndRender(processed, context);
}
