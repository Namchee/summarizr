import dedent from 'dedent';

import { OpenAI } from 'langchain/llms/openai';
import { HuggingFaceInference } from 'langchain/llms/hf';

import { getActionInput } from '@/utils/action';

import { InputException } from '@/exceptions/input';

import type { GithubIssue, GithubComment } from '@/types/github';
import type { RawKnowledge } from '@/types/knowledge';
import { sanitizeMarkdown } from './markdown';

const conversationPrompt = `Identify the solution from the following problem-solution conversation. Present the solution in form of simple suggestion. Conversation between participants will be separated by '---'.

Conversation may have a title or a link to a reproduction attempt that can be used to understand the context of the conversation.`;

function getLLM() {
  const { apiKey, modelProvider, model, maxTokens, temperature } =
    getActionInput();

  switch (modelProvider) {
    case 'openai':
      return new OpenAI({
        openAIApiKey: apiKey,
        modelName: model,
        maxTokens,
        temperature,
      });
    case 'huggingface':
      return new HuggingFaceInference({
        apiKey,
        model,
        maxTokens,
        temperature,
      });
    default:
      throw new InputException('model_provider', 'Unsupported model provider.');
  }
}

function formatIssueToPrompt(issue: GithubIssue, comments: GithubComment[]) {
  const commentStr = comments.map(
    comment => `@${comment.user.name}: ${comment.body}`,
  );

  commentStr.push(`@${issue.user}: ${issue.body}`);

  return dedent`
  Title: ${issue.title}

  ---
  ${commentStr.join('\n---\n')}
  ---

  Solution:
  `;
}

export async function summarizeIssue(
  issue: GithubIssue,
  comments: GithubComment[],
): Promise<RawKnowledge> {
  const llm = getLLM();

  const prompt = `${conversationPrompt}\n\n${formatIssueToPrompt(
    issue,
    comments,
  )}`;

  let completion = await llm.call(prompt);
  if (completion.startsWith('Solution:')) {
    completion = completion.replace('Solution:', '');
  }

  const problem = sanitizeMarkdown(
    `Title: ${issue.title}\nBody: ${issue.body}`,
  );

  return {
    problem,
    solution: completion.trim(),
  };
}