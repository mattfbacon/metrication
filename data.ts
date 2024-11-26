export type NonEmpty<T> = [T, ...T[]];

export type Scales = { extra?: number[], min?: number, max?: number };
export type NonderivedCanonicalUnit = ({ name: string, symbol: string, symbol_space?: boolean, factor?: number } & ({ type: 'si', scales?: Scales, powers?: string[] } | { type: 'single' }));
export type CanonicalUnit = NonderivedCanonicalUnit | { type: 'derived', from: Dimension, power: number };
export type Dimension = 'length' | 'mass' | 'area' | 'volume' | 'temperature' | 'power' | 'torque' | 'speed' | 'fuel efficiency';
export type Factor = number | { mul: number, add?: number, recip?: boolean };

export type ConvertedUnit<SymbolType = RegExp> = { name: string, symbols: NonEmpty<SymbolType>, dimension: Dimension, factor: Factor | NonEmpty<[Factor, string]>, hide?: SymbolType[] };
export type Data<SymbolType = RegExp> = { canonical_units: { [K in Dimension]: CanonicalUnit | NonEmpty<CanonicalUnit> }, converted_units: ConvertedUnit<SymbolType>[] };

const data: Data<string> = {
	"canonical_units": {
		"length": { "type": "si", "name": "metre", "symbol": "m", "scales": { "extra": [-2], "max": 3 }, "powers": ["area", "volume"] },
		"mass": [
			{ "type": "si", "name": "gram", "symbol": "g", "scales": { "max": 3 } },
			{ "type": "si", "name": "tonne", "symbol": "tonne", "factor": 1000000, "scales": { "min": 0, "max": 9 } },
		],
		"area": [
			{ "type": "derived", "from": "length", "power": 2 },
			{ "type": "single", "name": "hectare", "symbol": "ha", "factor": 10000 },
		],
		"volume": { "type": "si", "name": "litre", "symbol": "L" },
		"temperature": { "type": "single", "name": "celsius", "symbol": "°C", "symbol_space": false },
		"power": { "type": "si", "name": "watt", "symbol": "W" },
		"torque": { "type": "single", "name": "newton-metre", "symbol": "Nm" },
		"speed": { "type": "single", "name": "kilometres per hour", "symbol": "km/h" },
		"fuel efficiency": { "type": "single", "name": "litres per kilometre", "symbol": "L/km" },
	},
	"converted_units": [
		{
			"name": "mile",
			"symbols": ["miles?", "mi"],
			"dimension": "length",
			"factor": 1609.344,
		},
		{
			"name": "pound",
			"symbols": ["pounds?", "lbs?\.?"],
			"dimension": "mass",
			"factor": 453.59237,
		},
		{
			"name": "ounce",
			"symbols": ["ounces?", "ozs?\.?"],
			"dimension": "mass",
			"factor": 28.349523125,
		},
		{
			"name": "ton",
			"symbols": ["tons?"],
			"dimension": "mass",
			"factor": [[907180, "short ton"], [1016047, "long ton"], [1000000, "metric ton"]],
		},
		{
			"name": "acre",
			"symbols": ["acres?", "ac"],
			"dimension": "area",
			"factor": 4046.8564224,
		},
		{
			"name": "foot",
			"symbols": ["f(?:oo|ee)t", "ft", "['’]"],
			"dimension": "length",
			"factor": 0.3048,
		},
		{
			"name": "inch",
			"symbols": ["inch(?:es)?", "in", "[\"”]", "’’", "\'\'", "zoll"],
			"dimension": "length",
			"factor": 0.0254,
			"hide": [
				"\\d+[^a-z.]*in", // "2014 in Canada", "Symphony no. 4 in D minor", etc.
				".*-in", // Not used.
			],
		},
		{
			"name": "yard",
			"symbols": ["yards?", "yd"],
			"dimension": "length",
			"factor": 0.9144,
		},
		{
			"name": "fahrenheit",
			"symbols": ["(?:°|degrees?)?\\p{Zs}*F(?:ahrenheit)?", "℉"],
			"dimension": "temperature",
			"factor": [[{ "mul": 0.5555555555555556, "add": -32 }, "Absolute"], [0.5555555555555556, "Relative"]], // Rounded to f64 precision.
			"hide": [
				".*f", // Usually not given with lowercase F.
				".*\dF", // Usually not written as e.g. 27F.
			],
		},
		{
			"name": "gallon",
			"symbols": ["gallons?", "gal"],
			"dimension": "volume",
			"factor": [[3.785411784, "US gallon"], [4.54609, "Imperial gallon"]],
		},
		{
			"name": "cup",
			"symbols": ["cups?", "c"],
			"dimension": "volume",
			"factor": 0.2365882365,
			"hide": [
				"\\d+c", // Without space is not very common and comes up often in contexts like "1a, 1b, 1c".
				".*C", // "25 C" temperature, "25C" battery statistic.
			],
		},
		{
			"name": "horsepower",
			"symbols": ["(?:brake ?)?horsepower", "b?hp", "horses" /* sigh */],
			"dimension": "power",
			"factor": 745.69987158227022,
		},
		{
			"name": "pferdestarke",
			"symbols": ["pferdestarke", "PS", "P\\.\\p{Zs}*S==."],
			"dimension": "power",
			"factor": 735.49875,
		},
		{
			"name": "poundfoot",
			"symbols": ["pound\\p{Zs}*(?:-?\\p{Zs}*)?f(?:oo|ee)t", "lb\\.?\\p{Zs}*(?:-\\p{Zs}*)?ft\\.?", "ft\\.?\\p{Zs}*(?:-\\p{Zs}*)?lb\\.?"],
			"dimension": "torque",
			"factor": 1.355818,
		},
		{
			"name": "miles per hour",
			"symbols": ["(?:miles|mi|Meilen?)\\p{Zs}*(?:per|\\/)\\p{Zs}*(?:hour|hr|h)", "mph"],
			"dimension": "speed",
			"factor": 1.609344,
		},
		{
			"name": "cubic inch",
			"symbols": ["cubic inch(?:es)?", "cu\.? *in"],
			"dimension": "volume",
			"factor": 0.016387064,
		},
		{
			"name": "square foot",
			"symbols": ["sq(?:uare|\.) *f(?:oo|ee)t", "sq\.? *ft", "sf"],
			"dimension": "area",
			"factor": 0.09290304,
		},
		{
			"name": "cubic foot",
			"symbols": ["cu(?:bic|\.) *f(?:oo|ee)t", "cu\.? *ft"],
			"dimension": "volume",
			"factor": 28.316846592,
		},
		{
			"name": "miles per gallon",
			"symbols": ["miles per gallon", "mpg"],
			"dimension": "fuel efficiency",
			"factor": { "mul": 2.3521458333, "recip": true },
		}
	],
};
