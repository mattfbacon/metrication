import { process_node } from './processor';

process_node(document.body);

const track = new MutationObserver((changes, _observer) => {
	const targets = new Set(changes.map(record => record.target));
	for (const target of targets) {
		process_node(target);
	}
});
track.observe(document.body, { subtree: true, childList: true, characterData: true });
