// TODO: Allow multiple amounts like "10-20 mph", "10, 20, 30 feet". Not sure how to handle preserving the separators in the formatted result, though.

import type { CanonicalUnit, ConvertedUnit, Factor, NonderivedCanonicalUnit, Scales } from './data';
import { data as data_raw } from './data';
import * as util from './util';

const SI_STEP = 3; // 10^3 = 1000.

type PrefixData = { short: string, long: string };
const SI_PREFIXES: Map<number, PrefixData> = new Map([
	[-30, { short: 'q', long: 'quecto' }],
	[-27, { short: 'r', long: 'ronto' }],
	[-24, { short: 'y', long: 'yocto' }],
	[-21, { short: 'z', long: 'zepto' }],
	[-18, { short: 'a', long: 'atto' }],
	[-15, { short: 'f', long: 'femto' }],
	[-12, { short: 'p', long: 'pico' }],
	[-9, { short: 'n', long: 'nano' }],
	[-6, { short: 'µ', long: 'micro' }],
	[-3, { short: 'm', long: 'milli' }],
	[-2, { short: 'c', long: 'centi' }],
	[-1, { short: 'd', long: 'deci' }],
	[0, { short: '', long: '' }],
	[1, { short: 'da', long: 'deka' }],
	[2, { short: 'h', long: 'hecto' }],
	[3, { short: 'k', long: 'kilo' }],
	[6, { short: 'M', long: 'mega' }],
	[9, { short: 'G', long: 'giga' }],
	[12, { short: 'T', long: 'tera' }],
	[15, { short: 'E', long: 'exa' }],
	[18, { short: 'Z', long: 'zetta' }],
	[21, { short: 'Y', long: 'yotta' }],
	[27, { short: 'R', long: 'ronna' }],
	[30, { short: 'Q', long: 'quetta' }],
]);
const SI_MIN = util.iter_min(SI_PREFIXES.keys())!;
const SI_MAX = util.iter_max(SI_PREFIXES.keys())!;
const POWERS: Map<number, string> = new Map([
	[2, 'square'],
	[3, 'cubic'],
]);

const DIGIT_SEPARATOR = '\u{202f}';

type FormattedUnit = { replacement: string, info: string };

const FRACTIONS = new Map([...'¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅟↉'].map(x => [x, x.normalize('NFKC').replace('⁄', '/')]));

const units = Object.values(data_raw.converted_units).flatMap(unit => unit.symbols);
// XXX Could be optimised by somehow saving these values.
units.sort((a, b) => util.regex_min_match_length(b) - util.regex_min_match_length(a));

const units_regex = units.map(x => `(?:${x})`).join('|');
const fracs = util.iter_join(FRACTIONS.keys(), '');

const single = `((?:[+.-]*[\\d${fracs}]+(?:[\\d${fracs}.,\\-\\p{Zs}][\\d${fracs}]+)*)(?:\\p{Zs}*\\/\\p{Zs}*\\d+(?:[\\d.,\\p{Zs}]\\d+)*)?)\\p{Zs}*(?:\\+\\p{Zs}*)?(?:-\\p{Zs}*)?(${units_regex})`;
// .
const single_regex = new RegExp(single, 'igum');

const W = "[^\\p{L}\\p{M}\\p{Nd}\\p{Nl}\\p{Pc}]";
const repeated = `(?:(?<=${W})|^)${single}(?:\\p{Zs}*${single}+)*(?:(?=${W})|$)`;
// .
const repeated_regex = new RegExp(repeated, 'igum');

// .
const data = {
	...data_raw,
	converted_units: data_raw.converted_units.map(unit => ({
		...unit,
		symbols: util.map_non_empty(unit.symbols, symbol => new RegExp(symbol, 'iu')),
		hide: (unit.hide ?? []).map(pat => new RegExp(`^${pat}$`, 'u')),
	})),
};

function prepare_inner(unit: CanonicalUnit, inner_power: number, base_input_value: number): { symbol: string, name: string, value: number, factor: number, base_unit: NonderivedCanonicalUnit } {
	const base_factor = ('factor' in unit ? unit.factor : undefined) ?? 1;
	const base_value = base_input_value / base_factor;
	switch (unit.type) {
		case 'si':
			function* gen_scales_ascending(step: number, extras: number[]): Generator<number, void, undefined> {
				let scale = 0;
				while (true) {
					const next = scale + step;
					const these_extras = extras.filter(extra => extra > scale && extra < next);
					these_extras.sort();
					yield* these_extras;
					yield next;
					scale = next;
				}
			}
			function* gen_scales(description: Scales, step: number): Generator<number, void, undefined> {
				let inner;
				if (step < 0) {
					inner = gen_scales_ascending(-step, description.extra?.map(extra => -extra) ?? []);
					if (description.min !== undefined) {
						const max = -description.min;
						inner = util.iter_take_while(inner, x => x <= max);
					}
					inner = util.iter_map(inner, x => -x);
				} else {
					inner = gen_scales_ascending(step, description.extra ?? []);
					if (description.max !== undefined) {
						const max = description.max;
						inner = util.iter_take_while(inner, x => x <= max);
					}
				}
				yield* util.iter_filter(util.iter_take_while(inner, x => x <= SI_MAX && x >= SI_MIN), x => SI_PREFIXES.has(x));
			}
			const make_scaled = (): { scale: number, scaled_value: number } => {
				let ret = { scale: 0, scaled_value: base_value };
				if (base_value < 1) {
					// Go smaller.
					const scales_iter = gen_scales(unit.scales ?? {}, -SI_STEP);
					while (true) {
						const { value: scale, done } = scales_iter.next();
						if (done !== false) {
							break;
						}
						const scaled_value = base_value / Math.pow(10, scale * inner_power);
						ret = { scale, scaled_value };
						// Go until it's enough.
						if (scaled_value >= 1) {
							break;
						}
					}
				} else if (base_value < 1000) {
					// Already okay.
				} else {
					// Go bigger.
					const scales_iter = gen_scales(unit.scales ?? {}, SI_STEP);
					while (true) {
						const { value: scale, done } = scales_iter.next();
						if (done !== false) {
							break;
						}
						const scaled_value = base_value / Math.pow(10, scale * inner_power);
						// Go until the next one would be too much.
						if (scaled_value < 1) {
							break;
						}
						ret = { scale, scaled_value };
					}
				}
				return ret;
			};
			const { scale, scaled_value } = make_scaled();
			// We make sure that all scales we yield are valid SI prefixes;
			// this maybe can encoded in the type system, but it's far too cumbersome.
			const si_prefix = SI_PREFIXES.get(scale)!!;
			const long = unit.symbol.length > 2;
			const scaled_symbol = si_prefix[long ? 'long' : 'short'] + unit.symbol + (long && scaled_value != 1 ? 's' : '');
			const scaled_name = scale == 0 ? unit.name : `${unit.name} * 10^${scale}`;
			return { symbol: scaled_symbol, name: scaled_name, value: scaled_value, factor: base_factor * Math.pow(10, scale), base_unit: unit };
		case 'single':
			return { symbol: unit.symbol, name: unit.name, value: base_value, factor: base_factor, base_unit: unit };
		case 'derived':
			const { from, power } = unit;
			const base_unit = data.canonical_units[from];
			const inner = prepare(base_unit, power, base_input_value);
			const power_name = POWERS.get(power)!!;
			return { symbol: `${inner.symbol}^${power}`, name: `${power_name} ${inner.name}`, value: inner.value, factor: Math.pow(inner.factor, power), base_unit: inner.base_unit };
	}
}

function prepare(units: typeof data.canonical_units[keyof typeof data.canonical_units], inner_power: number, base_input_value: number): { symbol: string, name: string, value: number, factor: number, base_unit: NonderivedCanonicalUnit } {
	if (Array.isArray(units)) {
		let opts = util.map_non_empty(units, unit => prepare_inner(unit, inner_power, base_input_value));

		// Limit to only optimal options, if there are any.
		// We allow a leading zero here for cases like 1 acre = 4046 m^2 / 0.404 hectare.
		const optimal_opts = opts.filter(opt => opt.value >= 0.1);
		if (util.is_non_empty(optimal_opts)) {
			opts = optimal_opts;
		}

		// Force non-empty overload.
		return (util.arr_min as <T>(arr: util.NonEmpty<T>, f: (_: T) => any) => T)(opts, x => x.value);
	} else {
		return prepare_inner(units, inner_power, base_input_value);
	}
}

const FRACTIONS_REGEX = new RegExp(`[${util.iter_join(FRACTIONS.keys(), '')}]`, 'igum');
function parse_amount(raw_amount: string, lang: () => string): { value: number, precision: number } {
	let parts = raw_amount.replaceAll(FRACTIONS_REGEX, (frac) => ` ${FRACTIONS.get(frac)!} `).split('/').map(part => part.trim());

	if (parts.length > 2) {
		throw new Error('too many slashes');
	}

	// Test for mixed numbers.
	if (parts.length === 2) {
		const [mixed, denominator] = parts;
		const last_sep = /([ \-])[^ \-]*$/;
		const match = mixed.match(last_sep);
		if (match) {
			// `index` cannot be null because the regex is not global.
			const whole = mixed.slice(0, match.index!).trim();
			const numerator = mixed.slice(match.index! + match[1].length).trim();
			// Heuristic to reject situations like "1 000/9",
			// which is really "1000/9" with a space as the thousands separator.
			if (/^[1-9]/.test(numerator)) {
				parts = [whole, numerator, denominator];
			}
		}
	}

	const parsed_parts = parts.map(part => parse_amount_(part.trim(), lang));
	// e.g.:
	// - [2 ]3/100 has a precision of 2 because it is equivalent to 2.03.
	// - [2 ]3/101 has a precision of 3 because I think it's better to round up here.
	const precision = Math.max(...parsed_parts.map(part => part.precision), Math.ceil(Math.log10(parsed_parts[parsed_parts.length - 1].value)), 1);
	switch (parts.length) {
		case 1:
			return parsed_parts[0];
		case 2:
			return { value: parsed_parts[0].value / parsed_parts[1].value, precision };
		case 3:
			return { value: parsed_parts[0].value + (parsed_parts[1].value / parsed_parts[2].value), precision };
		default:
			throw new Error('unreachable');
	}
}

function determine_thousands_separator_type(raw_amount: string, lang: () => string): 'space' | 'comma' | 'period' {
	const irrelevant = !/[.,]/.test(raw_amount);
	if (irrelevant) {
		return 'space';
	}

	// Space before exactly one period or comma.
	const definitely_space = /^[^ .,]* [^.,]*[.,][^.,]*$/.test(raw_amount);
	if (definitely_space) {
		return 'space';
	}

	// Dot before comma, or multiple dots.
	const definitely_period = /\..*[.,]/.test(raw_amount);
	// Comma before dot, or multiple commas.
	const definitely_comma = /\,.*[.,]/.test(raw_amount);

	// Invalid.
	if (definitely_comma && definitely_period) {
		throw new Error('impossible comma and period mixture');
	}

	const comma = definitely_comma ? true :
		definitely_period ? false :
			new Intl.NumberFormat(lang()).format(1.2).includes('.');
	return comma ? 'comma' : 'period';
}

// We normalise to no thousands separator and period as decimal separator, e.g., "10000.5".
function normalise_number_format(raw_amount: string, lang: () => string): string {
	const thou_sep = determine_thousands_separator_type(raw_amount, lang);
	switch (thou_sep) {
		case 'space':
			return raw_amount.replaceAll(' ', '').replaceAll(',', '.');
		case 'comma':
			return raw_amount.replaceAll(/[ ,]/g, '');
		case 'period':
			return raw_amount.replaceAll(/[ \.]/g, '').replace(',', '.');
	}
}

function parse_amount_(raw_amount: string, lang: () => string): { value: number, precision: number } {
	const amount = normalise_number_format(raw_amount, lang);

	const dot_pos = amount.lastIndexOf('.');
	const precision = dot_pos == -1 ? 0 : amount.length - dot_pos - 1;
	const value = parseFloat(amount);
	if (isNaN(value)) {
		throw new Error(`could not parse \`${amount}\` (raw \`${raw_amount}\`)`);
	}
	return { value, precision };
}

function parse_unit(raw_unit: string): ConvertedUnit | null {
	return data.converted_units.find(unit => Object.values(unit.symbols).some(symbol => util.regex_matches_all(symbol, raw_unit))) ?? null;
}

function process(text: string, lang: () => string): (string | FormattedUnit)[] | null {
	const output = [];
	let last_index = 0;
	lang = util.memo(lang);

	for (const repeated_match of text.matchAll(repeated_regex)) {
		// console.log(repeated_match);
		const repeated_text = repeated_match[0];
		const single_matches = [...repeated_text.matchAll(single_regex)];

		const parsed: { span: { start: number, end: number }, amount: { value: number, precision: number, raw: string }, unit: ConvertedUnit<RegExp> }[] = single_matches.flatMap(single_match => {
			const [_, raw_amount, raw_unit] = single_match;

			const amount = parse_amount(raw_amount, lang);
			if (amount === null) {
				console.warn('failed to parse amount', amount);
				return [];
			}

			const unit = parse_unit(raw_unit);
			if (unit === null) {
				console.warn('failed to parse unit', unit);
				return [];
			}

			const start = repeated_match.index!! + single_match.index!!;
			const end = start + single_match[0].length;
			return [{ span: { start, end }, amount: { ...amount, raw: raw_amount }, unit }];
		});
		util.assert(parsed.every(x => !isNaN(x.amount.value)));
		// Group measurements of the same dimension, e.g., "4 feet 3 inches".
		const grouped = util.arr_group_by(parsed, x => x.unit.dimension);
		const processed = grouped.map(group => {
			const whole_span = { start: group[0].span.start, end: group[group.length - 1].span.end };
			const original_unit = group[0].unit;
			const canonical_unit = data.canonical_units[original_unit.dimension];
			const output_precision = group.map(measurement => measurement.amount.precision).reduce((a, b) => Math.max(a, b)) + 3;
			const units = [...new Set(group.map(measurement => measurement.unit))];

			const factors = units.map(unit => (Array.isArray(unit.factor) ? unit.factor : [[unit.factor, null]]) as [Factor, string | null][]);
			const converted_values = [...util.arr_product(factors)].map(these_factors => {
				const these_values = these_factors.map(([factor_, description], i) => {
					const item = group[i];
					const factor = typeof factor_ == 'number' ? { mul: factor_, add: 0 } : factor_;
					const recip = factor.recip ?? false;
					let value = item.amount.value;
					if (recip) {
						value = 1 / value;
					}
					return { value: (value + (factor.add ?? 0)) * factor.mul, factor_description: description, raw: item.amount.raw };
				})
				const total_value = these_values.map(x => x.value).reduce((a, b) => a + b);
				const description = these_values.map(x => `${x.raw.trim()} as ${x.factor_description}`).join(' + ');
				return { value: total_value, description };
			});

			const value_for_unit_calculation = util.geo_mean(converted_values.map(x => Math.abs(x.value)));
			const output_info = prepare(canonical_unit, 1, value_for_unit_calculation);
			const output_factor = output_info.factor;
			const suffix = `${output_info.base_unit.symbol_space ?? true ? ' ' : ''}${output_info.symbol}`;

			const final_values = converted_values.map(base_value => {
				const output_value = base_value.value / output_factor;
				const formatted_value = output_value.toFixed(output_precision).replace(/0+$/, '');
				let [int, fract] = formatted_value.split('.');
				int = util.str_rchunks(int, 3).join(DIGIT_SEPARATOR);
				fract = util.str_chunks(fract, 3).join(DIGIT_SEPARATOR);
				const formatted = `${int}.${fract}`.replace(/\.$/, '');
				return { ...base_value, formatted };
			})
			const formatted_value = final_values.map(v => v.formatted).join('/') + suffix;

			const unit_s = units.length != 1 ? '' : 's';
			const original = text.slice(whole_span.start, whole_span.end);
			const hide = (original_unit.hide ?? []).some(pat => pat.test(original));
			const main = hide ? `Converted: ${formatted_value}` : `Original: ${original}`;
			let info = `${main}\nDetected unit${unit_s}: ${units.map(unit => unit.name).join(', ')}\nConverted to: ${output_info.name}\n`;
			if (final_values.length > 1) {
				info += `\nThere was ambiguity in the conversion: the value could be interpreted as:\n`;
				for (const possibility of final_values) {
					info += `- ${possibility.description} = ${possibility.formatted}${suffix}\n`;
				}
			}

			return { replacement: hide ? original : formatted_value, info, span: whole_span };
		});

		for (const { replacement, info, span: { start, end } } of processed) {
			const before_text = text.slice(last_index, start);
			if (before_text != '') {
				output.push(before_text);
			}
			last_index = end;

			output.push({ replacement, info });
		}
	}

	if (output.length == 0) {
		return null;
	}

	const after_text = text.slice(last_index);
	if (after_text != '') {
		output.push(after_text);
	}

	return output;
}

const METRICATION_MARKER = Symbol();
type ElementWithMarker = Element & { [METRICATION_MARKER]?: boolean };

// Never processed.
const SPECIAL_ELEMENTS = ['base', 'head', 'link', 'meta', 'style', 'title', 'canvas', 'script', 'pre', 'code', 'textarea'];
const reject_this = (node: Node) => node instanceof HTMLElement && (SPECIAL_ELEMENTS.includes(node.tagName.toLowerCase()) || node.isContentEditable || node.classList.contains("ace_editor"));
const reject_including_ancestors = (node: Node) => reject_this(node) || (node instanceof HTMLElement && node.matches('[contenteditable] *, .ace_editor *' + SPECIAL_ELEMENTS.map(el => `, ${el} *`).join('')));

export function process_node(root: Node) {
	if (reject_including_ancestors(root)) {
		return;
	}

	const iter = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
		acceptNode(node) {
			if (reject_this(node)) {
				return NodeFilter.FILTER_REJECT;
			} else if (node instanceof Text) {
				return NodeFilter.FILTER_ACCEPT;
			} else {
				return NodeFilter.FILTER_SKIP;
			}
		}
	});
	let node;
	// We need to delay the replacement in order to not confuse the tree walker.
	// By delaying by one step, we make sure to only manipulate DOM elements before the current position.
	let last_to_replace = null;
	while ((node = iter.nextNode()) != null) {
		if (last_to_replace !== null) {
			last_to_replace.node.replaceWith(...last_to_replace.output);
			last_to_replace = null;
		}

		util.assert(node instanceof CharacterData);
		if ((node.parentElement as ElementWithMarker | undefined)?.[METRICATION_MARKER]) {
			continue;
		}
		const text = node.textContent;
		if (text === null) {
			continue;
		}

		const get_lang = (el => () => util.element_lang(el))(node.parentElement);
		const output = process(text, get_lang);
		if (output === null) {
			continue;
		}
		const html_output = output.map(item => {
			if (typeof item == 'string') {
				return item;
			} else {
				const el = document.createElement('abbr');
				el.innerText = item.replacement;
				el.setAttribute('title', item.info);
				(el as ElementWithMarker)[METRICATION_MARKER] = true;
				return el;
			}
		});
		last_to_replace = { node, output: html_output };
	}

	if (last_to_replace !== null) {
		last_to_replace.node.replaceWith(...last_to_replace.output);
	}
};
