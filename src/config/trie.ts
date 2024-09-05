export class Trie {
    private isTerminal: boolean = false;
    private children: Map<string, Trie>;

    constructor() {
        this.children = new Map();
    }

    public addWord(word: string): void {
        let node: Trie = this;
        for (const char of word) {
            if (!node.children.has(char)) {
                node.children.set(char, new Trie());
            }
            node = node.children.get(char)!;
        }
        node.isTerminal = true;
    }

    public search(word: string): boolean {
        return this.searchHelper(word, 0, []);
    }

    private searchHelper(word: string, index: number, path: string[]): boolean {
        if (index === word.length) {
            return this.isTerminal;
        }

        const char = word[index];

        const wildcard = this.children.get('*');

        if (wildcard) {
            // If there is a wildcard that is terminal, we found a match
            if (wildcard.isTerminal) {
                return true;
            }

            // If there is a wildcard, we can skip this character
            return wildcard.searchHelper(word, index + 1, [...path, '*']);
        }

        const child = this.children.get(char);
        if (!child) {
            return false;
        }

        return child.searchHelper(word, index + 1, [...path, char]);
    }

    static buildTrie(wordList: string[]): Trie {
        const trie = new Trie();
        for (const word of wordList) {
            trie.addWord(word);
        }
        return trie;
    }
}
