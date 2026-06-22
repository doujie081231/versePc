const AI_PROVIDERS = {};
const PLATFORMS = {};
const MODELS = {};
const TOOL_CONFIG = {};
const TOOL_RISK = {};
const TOOL_DISPLAY_NAMES = {};
const MODEL_PRICES = {};

function estimateCost() { return 0; }
function getProviderForModel() { return { key: 'zhipu' }; }
function getProviderInfo() { return { platform: null, modelInfo: null }; }
function buildApiHeaders() { return { 'Content-Type': 'application/json' }; }
function buildChatEndpoint() { return { url: '', method: 'POST' }; }
function buildNonStreamingEndpoint() { return { url: '', method: 'POST' }; }

module.exports = {
    AI_PROVIDERS, PLATFORMS, MODELS, MODEL_PRICES,
    TOOL_CONFIG, TOOL_RISK, TOOL_DISPLAY_NAMES,
    getProviderForModel, getProviderInfo, buildApiHeaders,
    buildChatEndpoint, buildNonStreamingEndpoint, estimateCost,
};
