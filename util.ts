// Attribution: https://gist.github.com/dherman/3d0b4733303eaf4bae5e
export function geo_mean(numbers: number[]): number {
	const log_sum = numbers.map(x => Math.log(x)).reduce((a, b) => a + b);
	return Math.exp(log_sum / numbers.length);
}

export function* iter_map<T, U>(iter: IterableIterator<T>, f: (_: T) => U): Generator<U, void> {
	let value: T;
	while (!({ value } = iter.next()).done) {
		yield f(value);
	}
}

export function* iter_take_while<T>(iter: IterableIterator<T>, pred: (_: T) => boolean): Generator<T, void> {
	let value: T;
	while (!({ value } = iter.next()).done) {
		if (!pred(value)) {
			break;
		}
		yield value;
	}
}

export function* iter_filter<T>(iter: IterableIterator<T>, pred: (_: T) => boolean): Generator<T, void> {
	let value: T;
	while (!({ value } = iter.next()).done) {
		if (pred(value)) {
			yield value;
		}
	}
}

export function iter_min<T>(iter: IterableIterator<T>, key: (_: T) => any = x => x): T | null {
	let value: T;
	let min: T | null = null;
	while (!({ value } = iter.next()).done) {
		min = min == null ? value : key(value) < key(min) ? value : min;
	}
	return min;
}

export function iter_max<T>(iter: IterableIterator<T>, key: (_: T) => any = x => x): T | null {
	let value: T;
	let max: T | null = null;
	while (!({ value } = iter.next()).done) {
		max = max == null ? value : key(value) > key(max) ? value : max;
	}
	return max;
}

export function iter_join<T>(iter: IterableIterator<string>, join?: string): string {
	// This is actually the fastest, at least in modern browsers.
	// https://stackoverflow.com/questions/51255046/call-join-on-a-generator-in-js#51255332
	return [...iter].join(join);
}

export function arr_min<T>(arr: NonEmpty<T>, key: (_: T) => any): T;
export function arr_min<T>(arr: T[], key: (_: T) => any): (T | null);
export function arr_min<T>(arr: T[], key = (x: T) => x) {
	if (is_non_empty(arr)) {
		return reduce_non_empty(arr, (a, b) => key(a) < key(b) ? a : b);
	} else {
		return null;
	}
};

export function arr_group_by<T>(arr: T[], key: (_: T) => any): NonEmpty<T>[] {
	if (is_empty(arr)) {
		return [];
	}

	const ret = [];
	let group = { key: key(arr[0]), arr: [arr[0]]satisfies NonEmpty<T> };
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

export function* arr_product<T>(arr: T[][]): Generator<T[], void> {
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

export function assert(cond: boolean): asserts cond {
	if (!cond) {
		alert("Metrication: assertion failed. see console for more info");
		throw new Error("assertion failed!");
	}
};

export type NonEmpty<T> = [T, ...T[]];

export const is_non_empty = <T>(arr: T[]): arr is NonEmpty<T> => arr.length > 0;
export const is_empty = <T>(arr: T[]): boolean => arr.length == 0;
export const assert_non_empty = <T>(arr: T[]): NonEmpty<T> => {
	assert(is_non_empty(arr));
	return arr;
};
export const map_non_empty = <T, U>(arr: NonEmpty<T>, f: (_: T) => U): NonEmpty<U> => assert_non_empty(arr.map(f));
export const reduce_non_empty = <T>(arr: NonEmpty<T>, f: (a: T, b: T) => T): T => arr.reduce(f);

// Attribution: https://stackoverflow.com/a/63716019
export function str_chunks(str: string, size: number): string[] {
	const length = str.length;
	const chunks = Array(Math.ceil(length / size));
	for (let i = 0, index = 0; index < length; i++) {
		chunks[i] = str.slice(index, index += size);
	}
	return chunks;
}
export function str_rchunks(str: string, size: number): string[] {
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
export function regex_min_match_length(regex: string): number {
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
}

export function regex_matches_all(re: RegExp, s: string): boolean {
	const match = s.match(re);
	return match !== null && match[0].length == s.length;
}

const MEMOED_MARKER = Symbol();
type Memoed = { [MEMOED_MARKER]?: unknown };

export function memo<T>(f: () => T): () => T {
	if (MEMOED_MARKER in (f as Memoed)) {
		return f;
	}

	let save: [false, null] | [true, T] = [false, null];
	const ret = () => {
		if (!save[0]) {
			save = [true, f()];
		}
		return save[1];
	};

	(ret as Memoed)[MEMOED_MARKER] = true;
	return ret;
}

// XXX Could be optimised by tracking language within `reject_including_ancestors`.
// Even if it's null, we would be able to stop there and take the navigator language.
export function element_lang(el: Element | null): string {
	while (el) {
		const attr = el.getAttribute('lang');
		if (attr !== null) {
			return attr;
		}
		el = el.parentElement;
	}
	return navigator.language;
}

// XXX Can be optimised with a manual implementation of split.
// Precondition: limit >= 2
// (1 is allowed but useless.)
export function split_n(haystack: string, needle: string, limit: number): string[] {
	if (limit == 0) {
		throw new RangeError('limit must be at least 1');
	}
	const last = limit - 1;

	const parts = haystack.split(needle);
	if (parts.length > limit) {
		parts.splice(last, parts.length - last, parts.slice(last).join(needle));
	}
	return parts;
}
