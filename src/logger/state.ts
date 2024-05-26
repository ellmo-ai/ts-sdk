import { AsyncLocalStorage } from "node:async_hooks";

class OllyLLMState {
    public constructor() { }
}

const _state = new OllyLLMState();