// Utility to redact potential leaks of coordinates and postal addresses from generated text
// This is a defense-in-depth filter and should be enabled by default via env flag ENABLE_SPATIAL_REDACTION

export function redactSpatialSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let text = input;

  // Regex patterns
  const patterns: Array<{ re: RegExp; replacement: string; description: string }> = [];

  // Decimal degree coordinates (lat, lng) like 40.7128, -74.0060 or with spaces
  patterns.push({
    re: /\b-?\d{1,2}\.\d{3,},?\s*,\s*-?\d{1,3}\.\d{3,}\b/g,
    replacement: '[coordenadas ocultas]',
    description: 'decimal degrees lat,lng',
  });

  // Latitude/Longitude mentions with numbers
  patterns.push({
    re: /(latitude|latitud|lat\.?|longitud|longitude|lng\.?)[^\d\n]*(\-?\d{1,3}(?:[\.,]\d+)?)/gi,
    replacement: '$1 [oculto]',
    description: 'lat/long labeled values',
  } as any);

  // DMS like 40° 26' 46" N 79° 58' 56" W
  patterns.push({
    re: /\b\d{1,2}°\s*\d{1,2}[′']\s*\d{1,2}(?:\.\d+)?[″"]?\s*[NSEWO]\b(?:\s*,?\s*\d{1,3}°\s*\d{1,2}[′']\s*\d{1,2}(?:\.\d+)?[″"]?\s*[NSEWO])?/g,
    replacement: '[coordenadas DMS ocultas]',
    description: 'DMS coordinates',
  });

  // Common street types in EN/ES to detect addresses like "123 Main St" or "123 Calle Mayor"
  patterns.push({
    re: /\b\d{1,5}\s+([A-ZÁÉÍÓÚÜÑ][\p{L}\.']+(?:\s+[A-ZÁÉÍÓÚÜÑ]?[\p{L}\.']+)*)\s+(Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Highway|Hwy\.?|Court|Ct\.?|Place|Pl\.?|Square|Sq\.?|Plaza|Calle|Av\.?|Avenida|Carrer|Rua|Rua\.?|Camino|Paseo|P\.?ª|Passeig)\b/giu,
    replacement: '[dirección oculta]',
    description: 'number + street name',
  });

  // Generic number + word that looks like an address (fallback, conservative)
  patterns.push({
    re: /\b\d{1,5}\s+[A-ZÁÉÍÓÚÜÑ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÜÑ]?[\p{L}]+){0,3}\b/giu,
    replacement: '[dirección aproximada oculta]',
    description: 'generic address-like',
  });

  for (const { re, replacement } of patterns) {
    text = text.replace(re, replacement);
  }

  return text;
}
