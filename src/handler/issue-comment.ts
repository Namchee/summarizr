import { context } from '@actions/github';

import {
  createReaction,
  deleteReaction,
  getIssueComments,
  getRepositoryContent,
  hasWriteAccess,
  updateRepositoryContent,
} from '@/service/github';
import { summarizeIssue } from '@/service/model/summarization';

import { ADD_KNOWLEDGE_PATTERN } from '@/constant/template';

import type { GithubIssue, GithubComment } from '@/types/github';
import type { Knowledge, RawKnowledge } from '@/types/knowledge';

async function handleAddKnowledgeCommand(
  issue: GithubIssue,
  comment: GithubComment,
): Promise<void> {
  const processingEmoji = await createReaction('eyes', comment.id);

  let knowledgeInput: RawKnowledge;
  const anchorSummary = ADD_KNOWLEDGE_PATTERN.exec(comment.body as string);
  if (anchorSummary?.length === 3) {
    const [_, problem, solution] = anchorSummary;

    knowledgeInput = {
      problem: problem.trim(),
      solution: solution.trim(),
    };
  } else {
    let comments = await getIssueComments();
    comments = comments.filter(comment => comment.user.type !== 'Bot');

    knowledgeInput = await summarizeIssue(issue, comments);

    // Temporarily log this
    console.log(knowledgeInput);
  }

  const { content, sha } = await getRepositoryContent();

  await updateRepositoryContent(
    JSON.stringify([
      ...JSON.parse(content),
      {
        issue_number: issue.number,
        title: issue.title,
        ...knowledgeInput,
      },
    ]),
    sha,
  );

  await Promise.all([
    createReaction('+1', comment.id),
    deleteReaction(comment.id, processingEmoji.id),
  ]);
}

async function handleDeleteKnowledgeCommand(
  issue: GithubIssue,
  comment: GithubComment,
): Promise<void> {
  const processingEmoji = await createReaction('eyes', comment.id);

  const { content, sha } = await getRepositoryContent();
  const knowlegdes = JSON.parse(content) as Knowledge[];

  const newKnowledges = knowlegdes.filter(
    knowledge => knowledge.issue_number !== issue.number,
  );

  await updateRepositoryContent(JSON.stringify(newKnowledges), sha);

  await Promise.all([
    createReaction('+1', comment.id),
    deleteReaction(comment.id, processingEmoji.id),
  ]);
}

export async function handleIssueCommentEvent(): Promise<void> {
  const issue = context.payload.issue as unknown as GithubIssue;
  const comment = context.payload.comment as unknown as GithubComment;

  if (!hasWriteAccess(comment.user.name)) {
    return;
  }

  if (comment.body.startsWith('/add-knowledge')) {
    await handleAddKnowledgeCommand(issue, comment);
  } else if (comment.body.startsWith('/delete-knowledge')) {
    await handleDeleteKnowledgeCommand(issue, comment);
  }
}
