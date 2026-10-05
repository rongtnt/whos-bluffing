// Reply drafts for the alerts: one two-choice question each, taken from posts/reply-templates.md with the link
// removed (a reply under a large account works when it is early, on topic and a question; the profile carries the
// link). The owner posts one by hand; nothing here is sent automatically.
const R = {
  gpt2_bert: 'Which came out earlier, GPT-2 or BERT? Most people in this thread will answer in a second. The harder question is how sure you are.',
  chatgpt_sd: 'Here is a question for anyone reading this thread. Which came out earlier, ChatGPT or Stable Diffusion? Pick one, then decide honestly how sure you are.',
  alphago_tf: 'Here is a small test for everyone in this thread. Which came earlier, AlphaGo’s 4–1 win in Seoul or the Transformer paper? Decide how sure you are before you look it up.',
  gpt3_chin: 'I suspect most people in this thread will get this one wrong. Which has more parameters, GPT-3 or Chinchilla? Pick one, then decide how sure you are.',
  gpt3_palm: 'Here is a small question for the replies. Which has more parameters, GPT-3 or PaLM? Try it without looking it up, and notice how sure you feel.',
  nvidia_amzn: 'Here is one for everyone in this thread. Which company is older, NVIDIA or Amazon? It’s easy to answer and harder to be sure about.',
  lstm_google: 'For anyone reading, which is older, the LSTM paper or Google? Try it without searching. Would you have been sure enough to stake 100% on it?',
};

const TOPICS = [
  [/\b(gpt|grok|claude|gemini|llama|model|release|launch|ship|shipping|version|v\d)\b/i, R.chatgpt_sd],
  [/\b(param|parameters|billion|trillion|compute|gpu|gpus|h100|b200|flops|training|cluster|colossus|data ?cent(er|re))\b/i, R.gpt3_chin],
  [/\b(agi|superintelligence|safety|alignment|singularity|doom)\b/i, R.lstm_google],
  [/\b(transformer|attention|paper|research|arxiv|benchmark)\b/i, R.alphago_tf],
  [/\b(openai|anthropic|xai|deepmind|google|microsoft|company|founded|startup|ipo)\b/i, R.nvidia_amzn],
];
const FALLBACK = [R.gpt2_bert, R.chatgpt_sd];
const SOMBER = /\b(crash|crashed|died|death|dead|killed|layoffs?|accident|condolences?|tragedy|funeral|shooting|war)\b/i;

// Two drafts for a post's text, topic matches first; none for somber posts (the template rules say skip those).
export function pickReplies(text) {
  if (SOMBER.test(text)) return [];
  const picked = TOPICS.filter(([re]) => re.test(text)).map(([, draft]) => draft);
  return [...new Set([...picked, ...FALLBACK])].slice(0, 2);
}
