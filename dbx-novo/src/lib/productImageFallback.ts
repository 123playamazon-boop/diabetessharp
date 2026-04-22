/** ASIN Amazon típico (10 chars alfanum). */
export function looksLikeAmazonAsin(asin: string): boolean {
  const a = asin.trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(a);
}

export function amazonImageUrlCandidates(asin: string): [string, string] {
  const enc = encodeURIComponent(asin.trim().toUpperCase());
  return [
    `https://images-na.ssl-images-amazon.com/images/P/${enc}.01._AC_SL200_.jpg`,
    `https://m.media-amazon.com/images/P/${enc}.01._AC_SL200_.jpg`,
  ];
}
