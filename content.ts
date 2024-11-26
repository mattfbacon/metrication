// TODO: Allow multiple amounts like "10-20 mph", "10, 20, 30 feet". Not sure how to handle preserving the separators in the formatted result, though.

declare var browser: { runtime: { getURL(path: string): string; } };

import type { CanonicalUnit, ConvertedUnit, Data, Factor, NonderivedCanonicalUnit, NonEmpty, Scales } from './data';

// Attribution: https://gist.github.com/dherman/3d0b4733303eaf4bae5e
function geo_mean(numbers: number[]): number {
	const log_sum = numbers.map(x => Math.log(x)).reduce((a, b) => a + b);
	return Math.exp(log_sum / numbers.length);
}

function* iter_map<T, U>(iter: IterableIterator<T>, f: (_: T) => U): Generator<U, void> {
	let value: T;
	while (!({ value } = iter.next()).done) {
		yield f(value);
	}
}
function* iter_take_while<T>(iter: IterableIterator<T>, pred: (_: T) => boolean): Generator<T, void> {
	let value: T;
	while (!({ value } = iter.next()).done) {
		if (!pred(value)) {
			break;
		}
		yield value;
	}
}
function* iter_filter<T>(iter: IterableIterator<T>, pred: (_: T) => boolean): Generator<T, void> {
	let value: T;
	while (!({ value } = iter.next()).done) {
		if (pred(value)) {
			yield value;
		}
	}
}
const iter_min = <T>(iter: IterableIterator<T>, key: (_: T) => any = x => x): T | null => {
	let value: T;
	let min: T | null = null;
	while (!({ value } = iter.next()).done) {
		min = min == null ? value : key(value) < key(min) ? value : min;
	}
	return min;
};
const iter_max = <T>(iter: IterableIterator<T>, key: (_: T) => any = x => x): T | null => {
	let value: T;
	let max: T | null = null;
	while (!({ value } = iter.next()).done) {
		max = max == null ? value : key(value) > key(max) ? value : max;
	}
	return max;
};


function arr_min<T>(arr: NonEmpty<T>, key: (_: T) => any): T;
function arr_min<T>(arr: T[], key: (_: T) => any): (T | null);
function arr_min<T>(arr: T[], key = (x: T) => x) {
	if (is_non_empty(arr)) {
		return reduce_non_empty(arr, (a, b) => key(a) < key(b) ? a : b);
	} else {
		return null;
	}
};

function arr_group_by<T>(arr: T[], key: (_: T) => any): NonEmpty<T>[] {
	if (is_empty(arr)) {
		return [];
	}

	const ret = [];
	let group = { key: key(arr[0]), arr: [arr[0]] satisfies NonEmpty<T> };
	for (const item of arr.slice(1)) {
		const item_key = key(item);
		if (item_key === group.key) {
			group.arr.push(item);
		} else {
			ret.push(group.arr);
			group = { key: item_key, arr: [item] };
		}
	}
	ret.push(group.arr);

	return ret;
}

function* arr_product<T>(arr: T[][]): Generator<T[], void> {
	if (is_non_empty(arr)) {
		const last = arr[arr.length - 1];
		for (const choice of last) {
			yield* iter_map(arr_product(arr.slice(0, -1)), combo => {
				combo.push(choice);
				return combo;
			});
		}
	} else {
		yield [];
	}
}

function assert(cond: boolean): asserts cond {
	if (!cond) {
		alert("Metrication: assertion failed. see console for more info");
		throw new Error("assertion failed!");
	}
};

const is_non_empty = <T>(arr: T[]): arr is NonEmpty<T> => arr.length > 0;
const is_empty = <T>(arr: T[]): boolean => arr.length == 0;
const assert_non_empty = <T>(arr: T[]): NonEmpty<T> => {
	assert(is_non_empty(arr));
	return arr;
};
const map_non_empty = <T, U>(arr: NonEmpty<T>, f: (_: T) => U): NonEmpty<U> => assert_non_empty(arr.map(f));
const reduce_non_empty = <T>(arr: NonEmpty<T>, f: (a: T, b: T) => T): T => arr.reduce(f);

// Attribution: https://stackoverflow.com/a/63716019
function str_chunks(str: string, size: number): string[] {
	const length = str.length;
	const chunks = Array(Math.ceil(length / size));
	for (let i = 0, index = 0; index < length; i++) {
		chunks[i] = str.slice(index, index += size);
	}
	return chunks;
}
function str_rchunks(str: string, size: number): string[] {
	const length = str.length;
	const chunks = Array(Math.ceil(length / size));
	if (length > 0) {
		chunks[0] = str.slice(0, length % size || size);
		for (let i = 1, index = chunks[0].length; index < length; i++) {
			chunks[i] = str.slice(index, index += size);
		}
	}
	return chunks;
}

// Yeah...
const regex_min_match_length = (regex: string): number => {
	// [max len, current alternation len]
	let lens = [[0, 0]];
	for (let i = 0; i < regex.length; ++i) {
		const ch = regex[i];
		switch (ch) {
			case '\\': {
				++i;
				const next = regex[i];
				if (next === 'P' || next == 'p') {
					++i;
					if (regex[i] === '{') {
						++i;
						for (; i < regex.length; ++i) {
							if (regex[i] == '}') {
								break;
							}
						}
					}
				}
				lens[lens.length - 1][1] += 1;
				break;
			} case '[':
				for (; i < regex.length; ++i) {
					const ch = regex[i];
					switch (ch) {
						case '\\':
							i += 1;
							continue;
						case ']':
							lens[lens.length - 1][1] += 1;
							i += 1;
							break;
						default: continue;
					}
					break;
				}
				break;
			case '(':
				lens.push([0, 0]);
				if (regex[i + 1] == '?') {
					++i;
					if (regex[i + 1] == ':') {
						++i;
					} else if (regex[i + 1] == '<') {
						++i;
						for (; i < regex.length; ++i) {
							if (regex[i] == '>') {
								break;
							}
						}
					}
				}
				break;
			case '|':
				lens[lens.length - 1][0] = Math.max(...lens[lens.length - 1]);
				lens[lens.length - 1][1] = 0;
				break;
			case '*':
			case '?':
				lens[lens.length - 1][1] -= 1;
				break;
			case '+':
				break;
			case ')':
				const last_len = Math.max(...lens.pop()!!);
				const next = regex[i + 1];
				if (next === '*' || next === '?') {
					++i;
				} else {
					lens[lens.length - 1][1] += last_len;
				}
				break;
			default:
				lens[lens.length - 1][1] += 1;
				break;
		}
	}
	return Math.max(...lens.pop()!!);
};
const regex_matches_all = (re: RegExp, s: string): boolean => {
	const match = s.match(re);
	return match !== null && match[0].length == s.length;
}

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
const SI_MIN = iter_min(SI_PREFIXES.keys())!!;
const SI_MAX = iter_max(SI_PREFIXES.keys())!!;
const POWERS: Map<number, string> = new Map([
	[2, 'square'],
	[3, 'cubic'],
]);

const DIGIT_SEPARATOR = '\u{202f}';

type FormattedUnit = { replacement: string, info: string };

class Processor {
	private readonly data: Data<RegExp>;
	private readonly single_regex: RegExp;
	private readonly repeated_regex: RegExp;

	constructor(data_raw: Data<string>) {
		const units = Object.values(data_raw.converted_units).flatMap(unit => unit.symbols);
		units.sort((a, b) => regex_min_match_length(b) - regex_min_match_length(a));

		const units_regex = units.map(x => `(?:${x})`).join('|');

		const single = `((?:[+.-]*[\\d¼½¾][\\d¼½¾., ]*))\\p{Zs}*(?:\\+\\p{Zs}*)?(?:-\\p{Zs}*)?(${units_regex})`;
		this.single_regex = new RegExp(single, 'igum');

		const W = "[^\\p{L}\\p{M}\\p{Nd}\\p{Nl}\\p{Pc}]";
		const repeated = `(?:(?<=${W})|^)${single}(?:\\p{Zs}*${single}+)*(?:(?=${W})|$)`;
		this.repeated_regex = new RegExp(repeated, 'igum');

		this.data = {
			...data_raw,
			converted_units: data_raw.converted_units.map(unit => ({
				...unit,
				symbols: map_non_empty(unit.symbols, symbol => new RegExp(symbol, 'iu')),
				hide: (unit.hide ?? []).map(pat => new RegExp(`^${pat}$`, 'u')),
			})),
		};
	}

	prepare_inner(unit: CanonicalUnit, inner_power: number, base_input_value: number): { symbol: string, name: string, value: number, factor: number, base_unit: NonderivedCanonicalUnit } {
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
							inner = iter_take_while(inner, x => x <= max);
						}
						inner = iter_map(inner, x => -x);
					} else {
						inner = gen_scales_ascending(step, description.extra ?? []);
						if (description.max !== undefined) {
							const max = description.max;
							inner = iter_take_while(inner, x => x <= max);
						}
					}
					yield* iter_filter(iter_take_while(inner, x => x <= SI_MAX && x >= SI_MIN), x => SI_PREFIXES.has(x));
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
				const base_unit = this.data.canonical_units[from];
				const inner = this.prepare(base_unit, power, base_input_value);
				const power_name = POWERS.get(power)!!;
				return { symbol: `${inner.symbol}^${power}`, name: `${power_name} ${inner.name}`, value: inner.value, factor: inner.factor * Math.pow(10, power), base_unit: inner.base_unit };
		}
	}

	prepare(units: typeof this.data.canonical_units[keyof typeof this.data.canonical_units], inner_power: number, base_input_value: number): { symbol: string, name: string, value: number, factor: number, base_unit: NonderivedCanonicalUnit } {
		if (Array.isArray(units)) {
			let opts = map_non_empty(units, unit => this.prepare_inner(unit, inner_power, base_input_value));

			// Limit to only optimal options, if there are any.
			const optimal_opts = opts.filter(opt => opt.value >= 1);
			if (is_non_empty(optimal_opts)) {
				opts = optimal_opts;
			}

			// Force non-empty overload.
			return (arr_min as <T>(arr: NonEmpty<T>, f: (_: T) => any) => T)(opts, x => x.value);
		} else {
			return this.prepare_inner(units, inner_power, base_input_value);
		}
	}

	static SPECIAL_AMOUNTS_MAP = new Map([
		["¼", 1 / 4],
		["½", 1 / 2],
		["¾", 3 / 4],
	]);

	parse_amount(raw_amount: string): { value: number, precision: number } | null {
		raw_amount = raw_amount.replaceAll(/[ ,]/g, '');
		{
			const special = Processor.SPECIAL_AMOUNTS_MAP.get(raw_amount);
			if (special !== undefined) {
				return { value: special, precision: 1 };
			}
		}
		const precision = raw_amount.split('.', 2)[1]?.length ?? 0;
		const value = parseFloat(raw_amount);
		if (isNaN(value)) {
			return null;
		}
		return { value, precision };
	}

	parse_unit(raw_unit: string): ConvertedUnit | null {
		return this.data.converted_units.find(unit => Object.values(unit.symbols).some(symbol => regex_matches_all(symbol, raw_unit))) ?? null;
	}

	process(text: string): (string | FormattedUnit)[] | null {
		const output = [];
		let last_index = 0;

		for (const repeated_match of text.matchAll(this.repeated_regex)) {
			// console.log(repeated_match);
			const repeated_text = repeated_match[0];
			const single_matches = [...repeated_text.matchAll(this.single_regex)];

			const parsed: { span: { start: number, end: number }, amount: { value: number, precision: number, raw: string }, unit: ConvertedUnit<RegExp> }[] = single_matches.flatMap(single_match => {
				const [_, raw_amount, raw_unit] = single_match;

				const amount = this.parse_amount(raw_amount);
				const unit = this.parse_unit(raw_unit);

				if (amount === null || unit === null) {
					return [];
				}

				const start = repeated_match.index!! + single_match.index!!;
				const end = start + single_match[0].length;
				return [{ span: { start, end }, amount: { ...amount, raw: raw_amount }, unit }];
			});
			// Group measurements of the same dimension, e.g., "4 feet 3 inches".
			const grouped = arr_group_by(parsed, x => x.unit.dimension);
			const processed = grouped.map(group => {
				const whole_span = { start: group[0].span.start, end: group[group.length - 1].span.end };
				const original_unit = group[0].unit;
				const canonical_unit = this.data.canonical_units[original_unit.dimension];
				const output_precision = group.map(measurement => measurement.amount.precision).reduce((a, b) => Math.max(a, b)) + 3;
				const units = [...new Set(group.map(measurement => measurement.unit))];

				const factors = units.map(unit => (Array.isArray(unit.factor) ? unit.factor : [[unit.factor, null]]) as [Factor, string | null][]);
				const converted_values = [...arr_product(factors)].map(these_factors => {
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

				const value_for_unit_calculation = geo_mean(converted_values.map(x => x.value));
				const output_info = this.prepare(canonical_unit, 1, value_for_unit_calculation);
				const output_factor = output_info.factor;
				const suffix = `${output_info.base_unit.symbol_space ?? true ? ' ' : ''}${output_info.symbol}`;

				const final_values = converted_values.map(base_value => {
					const output_value = base_value.value / output_factor;
					const formatted_value = output_value.toFixed(output_precision).replace(/0+$/, '');
					let [int, fract] = formatted_value.split('.');
					int = str_rchunks(int, 3).join(DIGIT_SEPARATOR);
					fract = str_chunks(fract, 3).join(DIGIT_SEPARATOR);
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
}

const METRICATION_MARKER = Symbol();
type ElementWithMarker = Element & { [METRICATION_MARKER]?: boolean };

// Never processed.
const SPECIAL_ELEMENTS = ['BASE', 'HEAD', 'LINK', 'META', 'STYLE', 'TITLE', 'CANVAS', 'SCRIPT'];

(async () => {
	const data_raw: Data<string> = eval(`"use strict";${await (await fetch(browser.runtime.getURL('out/data.js'))).text()};data`);
	const processor = new Processor(data_raw);

	const reject = (node: Node) => node instanceof HTMLElement && (SPECIAL_ELEMENTS.includes(node.tagName) || (node.isContentEditable && node.classList.contains("ace_editor")));
	const process_node = (root: Node) => {
		if (reject(root)) {
			return;
		}

		const iter = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
			acceptNode(node) {
				if (reject(node)) {
					return NodeFilter.FILTER_REJECT;
				} else if (node instanceof Text) {
					return NodeFilter.FILTER_ACCEPT;
				} else {
					return NodeFilter.FILTER_SKIP;
				}
			}
		});
		const fragment = document.createDocumentFragment();
		let node;
		let last_to_replace = null;
		while ((node = iter.nextNode()) != null) {
			if (last_to_replace !== null) {
				fragment.replaceChildren(...last_to_replace.output);
				last_to_replace.node.replaceWith(fragment);
				last_to_replace = null;
			}

			assert(node instanceof CharacterData);
			if ((node.parentElement as ElementWithMarker | undefined)?.[METRICATION_MARKER]) {
				continue;
			}
			const text = node.textContent;
			if (text === null) {
				continue;
			}

			const output = processor.process(text);
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
			fragment.replaceChildren(...last_to_replace.output);
			last_to_replace.node.replaceWith(fragment);
		}
	};

	process_node(document.body);

	const track = new MutationObserver((changes, _observer) => {
		const targets = new Set(changes.map(record => record.target));
		for (const target of targets) {
			if (target instanceof HTMLElement && (SPECIAL_ELEMENTS.includes(target.tagName) || target.matches('[contenteditable] *, .ace_editor *' + SPECIAL_ELEMENTS.map(el => `, ${el.toLowerCase()} *`).join('')))) {
				continue;
			}
			process_node(target);
		}
	});
	track.observe(document.body, { subtree: true, childList: true, characterData: true });
})();
