class OllyLLMState {
    public constructor() { }


}

class OllyLLM {
    private static instance: OllyLLM;
    private state: OllyLLMState;

    private constructor() {
        this.state = new OllyLLMState();
    }

    public static getInstance(): OllyLLM {
        if (!OllyLLM.instance) {
            OllyLLM.instance = new OllyLLM();
        }
        return OllyLLM.instance;
    }
}

function init(opts: {
    apiKey: string,
    baseUrl: string,
    debug?: boolean,
}) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!opts.apiKey) {
        throw new Error('OllyLLM: apiKey is required');
    }
    if (!opts.baseUrl) {
        throw new Error('OllyLLM: baseUrl is required');
    }
}