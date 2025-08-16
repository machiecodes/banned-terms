import * as github from '@actions/github';
import * as core from "@actions/core";
import * as fs from 'fs';

async function run() {
    const token = process.env.GITHUB_TOKEN;
    if (!token || token.length === 0) {
        core.setFailed("Could not find a usable Github token.");
        return;
    }

    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.issue) {
        core.setFailed("This action is intended to run on opened issues only.");
        return;
    }

    const configPath = core.getInput('config-path') || '.github/workflows/banned-terms.json';

    let config;
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configContent);
    } catch (error) {
        core.setFailed(`Failed to read or parse config file at ${configPath}: ${error.message}.`);
        return;
    }
    
    if (!config.rules || !Array.isArray(config.rules)) {
        core.setFailed("Config file must contain a 'rules' array.");
        return;
    }

    const issue = context.payload.issue;

    const issueTitle = issue.title.toLowerCase();
    const issueBody = (issue.body || '').toLowerCase();
    const issueContent = `${issueTitle} ${issueBody}`;

    for (const rule of config.rules) {
        if (!rule.terms || !Array.isArray(rule.terms)) {
            core.warning("Skipping rule with invalid 'terms' array.");
            continue;
        }

        for (const term of rule.terms) {
            if (!checkTerm(issueContent, term)) continue;

            core.info(`Found banned term: "${foundTerm}."`);
            closeIssue(octokit, context, config, issue, rule.message);
            break;
        }
    }

    core.info("No banned terms found in issue.");
}

function checkTerm(issueBody, term) {
    if (issueBody.includes(term.replaceAll(' ', '-'))) return true;
    if (issueBody.includes(term.replaceAll(' ', ''))) return true;
    return issueBody.includes(term);
}

async function closeIssue(octokit, context, config, issue, message) {
    const { owner, repo } = context.repo;
    const issueNumber = issue.number;

    if (message) {
        await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body: message
        });
    } else {
        core.warning("Corresponding rule did not contain a valid message property.")
    }

    if (config.add_label) {
        await octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: [config.add_label]
        });

        core.info(`Added label: ${config.add_label}.`);
    }

    if (config.lock_conversation === true) {
        await octokit.rest.issues.lock({
            owner,
            repo,
            issue_number: issueNumber,
            lock_reason: 'spam'
        });

        core.info("Conversation locked.");
    }

    await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed'
    });

    core.info("Issue closed successfully.");
}

run().catch(error => {
    core.setFailed(`Action failed with error: ${error.message}`);
});
