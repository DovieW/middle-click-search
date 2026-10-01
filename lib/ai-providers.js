// Website handoffs, not provider APIs. Keep provider behavior explicit.
export const AI_PROVIDERS = Object.freeze([
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', send: 'experimental', hint: '' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', send: 'experimental', hint: 'Draft filling is experimental.' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', send: 'manual', hint: 'Review and send in Claude.' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search', send: 'native', hint: 'Perplexity sends on opening.' },
  { id: 'custom-ai', name: 'Custom AI', send: 'manual', hint: 'Website controls sending.' },
].map(Object.freeze));
export const aiProvider = id => AI_PROVIDERS.find(provider => provider.id === id);
