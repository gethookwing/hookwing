/**
 * GitHub-specific types
 */

export interface GitHubEvent {
  action?: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
  };
  sender: {
    login: string;
    id: number;
    type: string;
  };
  [key: string]: unknown;
}

export interface GitHubWebhookConfig {
  webhookSecret: string;
}

export type GitHubEventHandler = (event: GitHubEvent) => Promise<void>;

export interface GitHubHandler {
  verify: (payload: string, signatureHeader: string) => GitHubEvent;
  handle: (
    eventType: string,
    event: GitHubEvent,
    handlers: Partial<Record<string, GitHubEventHandler>>,
  ) => Promise<void>;
}

// Common GitHub event types
export type GitHubEventType =
  | 'push'
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'issues'
  | 'issue_comment'
  | 'release'
  | 'workflow_run'
  | 'workflow_dispatch'
  | 'deployment'
  | 'deployment_status'
  | 'check_run'
  | 'check_suite'
  | 'commit_comment'
  | 'create'
  | 'delete'
  | 'fork'
  | 'gollum'
  | 'label'
  | 'member'
  | 'milestone'
  | 'page_build'
  | 'project'
  | 'project_card'
  | 'project_column'
  | 'public'
  | 'pull_request_target'
  | 'repository'
  | 'repository_dispatch'
  | 'security_and_analysis'
  | 'star'
  | 'status'
  | 'team_add'
  | 'watch';

// Event-specific payloads
export interface PushEvent extends GitHubEvent {
  ref: string;
  before: string;
  after: string;
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: { name: string; email: string; username: string };
  }>;
}

export interface PullRequestEvent extends GitHubEvent {
  action:
    | 'opened'
    | 'closed'
    | 'reopened'
    | 'synchronize'
    | 'assigned'
    | 'unassigned'
    | 'review_requested'
    | 'review_request_removed'
    | 'ready_for_review'
    | 'locked'
    | 'unlocked';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    html_url: string;
    user: { login: string; id: number };
  };
}

export interface IssuesEvent extends GitHubEvent {
  action:
    | 'opened'
    | 'closed'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'milestoned'
    | 'demilestoned';
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    html_url: string;
    user: { login: string; id: number };
  };
}

export interface ReleaseEvent extends GitHubEvent {
  action: 'published' | 'unpublished' | 'created' | 'edited' | 'deleted' | 'prereleased';
  release: {
    id: number;
    tag_name: string;
    name: string | null;
    body: string | null;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
  };
}
