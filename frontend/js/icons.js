/* icons.js — ikon SVG per komoditas (satu gaya: garis tipis + isi lembut)
 *
 * Dipakai oleh app.js lewat tiga fungsi global:
 *   commodityKey(c)        -> kunci ikon, mis. "beras", "cabai-rawit"
 *   commodityIcon(c)       -> string <svg> saja (warna mengikuti `color` CSS)
 *   commodityBadge(c, ukuran) -> lencana bulat berisi ikon ('sm' | 'md' | 'lg')
 *
 * Ikon dicari lewat: field `icon` (kalau berupa kunci yang dikenal) ->
 * kata kunci pada nama komoditas -> ID induk PIHPS (mis. "7_13" -> 7).
 * Jadi data live dari BI tetap dapat ikon yang tepat walau field `icon` kosong.
 *
 * Sengaja ditulis tanpa sintaks baru supaya jalan di browser lama (Chrome 109 / Windows 7).
 */
(function (global) {
  'use strict';

  var FILL = ' fill="currentColor" fill-opacity=".16"';

  // Isi tiap ikon (viewBox 24x24). Semua garis memakai stroke="currentColor".
  var SHAPES = {
    'beras':
      '<path' + FILL + ' d="M8.9 7.6C6.5 9.8 5 12.5 5 15.6 5 19.1 7.7 21 12 21s7-1.9 7-5.4c0-3.1-1.5-5.8-3.9-8"/>' +
      '<path d="M9.2 7.6 8.6 4.6c.9-.9 2-1.2 3.4-1.2s2.5.3 3.4 1.2l-.6 3"/>' +
      '<path d="M8.7 7.7c2 .9 4.6.9 6.6 0"/>' +
      '<path d="M12 11.4c1.8 1.3 1.8 4.6 0 6.6-1.8-2-1.8-5.3 0-6.6z"/>',

    'cabai-merah':
      '<path' + FILL + ' d="M7.9 6.2C14 5 20 9.6 19.8 19.2 12.8 18.8 6.6 14.6 5.9 8.4 5.8 7.4 6.6 6.5 7.9 6.2z"/>' +
      '<path d="M5.9 8.4C5.3 6.9 6.2 5.4 8.4 4.9 8.6 6 8.3 7.2 7.5 8.2"/>' +
      '<path d="M7.7 4.9C8 3.6 9.2 2.9 10.8 3.1"/>',

    'cabai-rawit':
      '<path' + FILL + ' d="M5.7 7.4c1.5-.9 3.7-.6 4 1 .4 3.4-.6 7.5-2.4 10.6C5.7 16.1 4.9 10.6 5.7 7.4z"/>' +
      '<path d="M5.7 7.4c.2-1.1.9-1.7 2-1.7s1.7.6 2 1.7M7.7 5.7V3.6"/>' +
      '<g transform="rotate(18 15.5 12)">' +
      '<path' + FILL + ' d="M12.9 7.4c1.5-.9 3.7-.6 4 1 .4 3.4-.6 7.5-2.4 10.6-1.6-2.9-2.4-8.4-1.6-11.6z"/>' +
      '<path d="M12.9 7.4c.2-1.1.9-1.7 2-1.7s1.7.6 2 1.7M14.9 5.7V3.6"/></g>',

    'daging-sapi':
      '<path' + FILL + ' d="M4.8 11.4c0-3.9 3-6.9 7.1-6.9 5 0 7.8 3 7.8 6.6 0 5-3.6 8.4-8.6 8.4-4.3 0-6.3-3.4-6.3-8.1z"/>' +
      '<path d="M7.4 11c.2-2.2 1.9-3.9 4.5-3.9"/>' +
      '<circle cx="14.6" cy="14.2" r="2.2"/><path d="M14.6 13.2v2"/>',

    'daging-ayam':
      '<g transform="rotate(38 12 12)">' +
      '<path' + FILL + ' d="M12 2.8c3 0 5.2 2.2 5.2 5 0 2.4-1.5 4.4-3.5 5.2v1.4h-3.4V13C8.3 12.2 6.8 10.2 6.8 7.8c0-2.8 2.2-5 5.2-5z"/>' +
      '<path d="M10.3 14.4v4.2M13.7 14.4v4.2"/>' +
      '<circle cx="10.2" cy="19.6" r="1.5"/><circle cx="13.8" cy="19.6" r="1.5"/></g>',

    'telur':
      '<path' + FILL + ' d="M12 3.4c3.5 0 6.4 5.1 6.4 9.2 0 3.8-2.9 6.6-6.4 6.6s-6.4-2.8-6.4-6.6c0-4.1 2.9-9.2 6.4-9.2z"/>' +
      '<path d="M9.3 12.4c.1-1.7.7-3.2 1.7-4.4"/>' +
      '<path d="M8 21.4h8"/>',

    'bawang-merah':
      '<path' + FILL + ' d="M12 6.2c3.6 0 6.5 2.9 6.5 6.6 0 3.8-2.9 6.4-6.5 6.4s-6.5-2.6-6.5-6.4c0-3.7 2.9-6.6 6.5-6.6z"/>' +
      '<path d="M12 6.2c-.6-1.6-.3-2.6.8-3.4"/>' +
      '<path d="M9.6 7.3c-1.5 2.4-1.5 9.4 0 11.8M14.4 7.3c1.5 2.4 1.5 9.4 0 11.8"/>' +
      '<path d="M10.8 20.3l-.4 1.3M12 20.3v1.5M13.2 20.3l.4 1.3"/>',

    'bawang-putih':
      '<path' + FILL + ' d="M12 3.2c.5 2 1.5 3.2 3.2 4.4 2.6 1.1 4.3 3.4 4.3 6.1 0 3.9-3.4 6.5-7.5 6.5s-7.5-2.6-7.5-6.5c0-2.7 1.7-5 4.3-6.1C10.5 6.4 11.5 5.2 12 3.2z"/>' +
      '<path d="M12 8.4c-1.9 2.6-2 7.2 0 9.8"/>' +
      '<path d="M8.6 9.6c-1.8 2.3-1.7 6.2.6 8.5M15.4 9.6c1.8 2.3 1.7 6.2-.6 8.5"/>' +
      '<path d="M10.6 21.2h2.8"/>',

    'minyak-goreng':
      '<path' + FILL + ' d="M10 5.6 8.6 8.2c-.6 1-.9 2-.9 3.1V19a2 2 0 0 0 2 2h4.6a2 2 0 0 0 2-2v-7.7c0-1.1-.3-2.1-.9-3.1L14 5.6z"/>' +
      '<path d="M10 5.6V3.2h4v2.4M9.4 3.2h5.2"/>' +
      '<path d="M12 12.2c1.5 1.9 2.3 2.9 2.3 4a2.3 2.3 0 0 1-4.6 0c0-1.1.8-2.1 2.3-4z"/>',

    'gula':
      '<path' + FILL + ' d="M6.8 5.6h10.4l.9 14.6H5.9z"/>' +
      '<path d="M5.8 5.6h12.4M5.9 20.2h12.2"/>' +
      '<path d="M8 3.8v1.8M10.7 3.8v1.8M13.3 3.8v1.8M16 3.8v1.8"/>' +
      '<path d="M12 9.6l3 1.7v3.4l-3 1.7-3-1.7v-3.4z"/><path d="M9 11.3l3 1.7 3-1.7M12 13v3.4"/>',

    'umum':
      '<path' + FILL + ' d="M12 3.2 19.6 7.3v9.4L12 20.8l-7.6-4.1V7.3L12 3.2z"/>' +
      '<path d="M4.4 7.3 12 11.4l7.6-4.1M12 11.4v9.4"/>'
  };

  // Warna aksen tiap komoditas — dibuat hangat & agak pudar supaya serasi dengan tema gelap emas.
  var TINTS = {
    'beras': '#E3C98A',
    'cabai-merah': '#F0705F',
    'cabai-rawit': '#EE8A52',
    'daging-sapi': '#E58C7B',
    'daging-ayam': '#E9B070',
    'telur': '#F1DEB4',
    'bawang-merah': '#C98FB5',
    'bawang-putih': '#E8E0CE',
    'minyak-goreng': '#E6C255',
    'gula': '#D9D4C7',
    'umum': '#D4A857'
  };

  // Urutan penting: aturan yang lebih spesifik harus di atas ("telur ayam" sebelum "ayam").
  var NAME_RULES = [
    ['cabai rawit', 'cabai-rawit'],
    ['cabai', 'cabai-merah'],
    ['beras', 'beras'],
    ['sapi', 'daging-sapi'],
    ['telur', 'telur'],
    ['ayam', 'daging-ayam'],
    ['bawang merah', 'bawang-merah'],
    ['bawang putih', 'bawang-putih'],
    ['minyak', 'minyak-goreng'],
    ['gula', 'gula']
  ];

  // ID induk komoditas di PIHPS (bagian sebelum "_", mis. "7_13" -> 7).
  var PARENT_IDS = {
    '1': 'beras', '2': 'daging-ayam', '3': 'daging-sapi', '4': 'telur', '5': 'bawang-merah',
    '6': 'bawang-putih', '7': 'cabai-merah', '8': 'cabai-rawit', '9': 'minyak-goreng', '10': 'gula'
  };

  function commodityKey(c) {
    c = c || {};
    if (c.icon && SHAPES[c.icon]) return c.icon;

    var name = String(c.name || '').toLowerCase();
    for (var i = 0; i < NAME_RULES.length; i++) {
      if (name.indexOf(NAME_RULES[i][0]) !== -1) return NAME_RULES[i][1];
    }

    var parent = String(c.id || '').split('_')[0];
    if (PARENT_IDS[parent]) return PARENT_IDS[parent];

    return 'umum';
  }

  function rgba(hex, alpha) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function svgFor(key) {
    return '<svg class="ci" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      SHAPES[key] + '</svg>';
  }

  function commodityIcon(c) {
    return svgFor(commodityKey(c));
  }

  function commodityBadge(c, size) {
    var key = commodityKey(c), tint = TINTS[key] || TINTS.umum;
    return '<span class="ci-badge ' + (size || 'md') + '" data-icon="' + key + '" ' +
      'style="color:' + tint + ';background:' + rgba(tint, 0.13) + ';border-color:' + rgba(tint, 0.3) + '">' +
      svgFor(key) + '</span>';
  }

  global.commodityKey = commodityKey;
  global.commodityIcon = commodityIcon;
  global.commodityBadge = commodityBadge;
  global.COMMODITY_ICON_KEYS = Object.keys(SHAPES);
})(window);
