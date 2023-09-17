import { context } from '@actions/github';

import dedent from 'dedent';

import { createIssueComment, getRepositoryContent } from '@/utils/github';

import { getSimilarIssues } from '@/utils/similarity';
import { logDebug } from '@/utils/logger';

import type { GithubIssue } from '@/types/github';
import type { Knowledge } from '@/types/knowledge';

export async function handleIssueCreatedEvent(): Promise<void> {
  const issue = context.payload.issue as GithubIssue;

  const { content } = await getRepositoryContent();
  const knowledges = JSON.parse(content) as Knowledge[];
  if (!knowledges.length) {
    logDebug('Existing knowledge not found');

    return;
  }

  const issueText = `Title: ${issue.title}\nBody: ${issue.body}`;
  const similarIssues = await getSimilarIssues(issueText, knowledges);

  logDebug(`Found ${similarIssues.length} similar issue(s)`);

  if (similarIssues.length) {
    const possibleSolutions = similarIssues.map(
      (issue, index) => `${index + 1}. ${issue.solution}`,
    );
    const references = similarIssues.map(
      (issue, index) => `${index + 1}. #${issue.issue_number}`,
    );

    const outputBody = dedent`
    ## Possible Solutions
  
    ${possibleSolutions.join('\n')}
  
    ## Related Issues
  
    ${references.join('\n')}
  
    <sub>This comment is created by Duplikat, your friendly GitHub Action issue triaging bot.</sub>
    `;

    await createIssueComment(outputBody);
  }
}
