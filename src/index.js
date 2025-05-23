import * as github from '@actions/github';
import * as core from "@actions/core";

async function run() {
    const token = core.getInput('GITHUB_TOKEN');
    if (token.length === 0) {
        core.setFailed("Could not find a usable token, exiting.");
        return;
    }

    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.issue) {
        core.setFailed("This action is intended to run on issue events only, skipping.");
        return;
    }

    const bannedTerms = core.getMultilineInput('banned-words').map(word => word.toLowerCase());
    if (bannedTerms.length === 0) {
        core.setFailed("No banned terms were provided, exiting.");
        return;
    }

    const issueTitle = context.payload.issue.title || '';
    const issueBody = context.payload.issue.body || '';
    const issueText = `${issueTitle} ${issueBody}`.toLowerCase();

    for (const term of bannedTerms) {
        if (!checkTerm(issueText, term)) continue;

        core.info(`Found banned term "${term}" in issue #${context.payload.issue.number}.`);
        await closeIssue(term, octokit, context);
        return;
    }
}

function checkTerm(text, term) {
    if (text.includes(term)) return true;
    if (text.includes(term.replaceAll(' ', '-'))) return true;
    return text.includes(term.replaceAll(' ', ''));
}

async function closeIssue(foundTerm, octokit, context) {
    const issueNumber = context.payload.issue.number;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    let closeMessage = `This issue is being automatically closed because it contains the 
    term ${foundTerm}. Generally this means your issue has been answered in this project's 
    FAQ, or is not an issue the developers wish to provide support for.\n
    \n
    _If you believe this issue was closed in error, you may reopen it._`

    // IDE for whatever reason can't find the rest property yippee

    try {
        await octokit.rest.issues.update({
            owner, repo, issue_number: issueNumber, state: 'closed', state_reason: 'not_planned'
        });

        core.info('Issue closed successfully.');
    } catch (error) {
        core.setFailed(`Failed to close issue: ${error.message}`);
        return;
    }

    try {
        await octokit.rest.issues.createComment({
            owner, repo, issue_number: issueNumber, body: closeMessage
        });

        core.info('Comment added successfully.');
    } catch (error) {
        core.setFailed(`Failed to add comment: ${error.message}`);
        return;
    }

    const closeLabel = core.getInput('close-label');
    if (closeLabel.length === 0) return;

    try {
        await octokit.rest.issues.addLabels({
            owner, repo, issue_number: issueNumber, labels: [closeLabel]
        });

        core.info('Label added successfully.');
    } catch (error) {
        core.setFailed(`Failed to add label: ${error.message}`);
    }
}

run().catch(error => {
    core.setFailed(`Action failed with error: ${error.message}`);
});
