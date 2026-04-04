import { TaskState } from "@optio/shared";
import type { PipelineStage } from "@optio/shared";
import * as taskService from "./task-service.js";
import { taskQueue } from "../workers/task-worker.js";
import { logger } from "../logger.js";

const log = logger.child({ module: "pipeline-stage" });

/**
 * Trigger the next pipeline stage after the current one completes.
 * Returns the new subtask ID, or null if there is no next stage.
 */
export async function triggerNextStage(
  parentTaskId: string,
  completedStage: string,
): Promise<string | null> {
  const parentTask = await taskService.getTask(parentTaskId);
  if (!parentTask) return null;

  // Load pipeline stages for this repo
  const { getRepoByUrl, getPipelineStages } = await import("./repo-service.js");
  const repoConfig = await getRepoByUrl(parentTask.repoUrl);
  if (!repoConfig) return null;

  const stages = await getPipelineStages(repoConfig.id);
  if (stages.length === 0) return null;

  // Find the completed stage and determine the next one
  const currentIdx = stages.findIndex((s) => s.stage === completedStage);
  if (currentIdx === -1) return null;

  const nextStage = findNextEnabledStage(stages, currentIdx + 1);
  if (!nextStage) return null;

  // Handle known stage types
  if (nextStage.stage === "review") {
    return triggerReviewStage(parentTaskId, nextStage);
  }

  // For custom stages (qa, deploy, etc.), create a generic subtask
  return triggerGenericStage(parentTaskId, parentTask, nextStage);
}

/**
 * Trigger the review stage — delegates to the existing review-service
 * which already handles PR context fetching and review prompt rendering.
 */
async function triggerReviewStage(
  parentTaskId: string,
  stage: PipelineStage,
): Promise<string | null> {
  try {
    const { launchReview } = await import("./review-service.js");
    const reviewTaskId = await launchReview(parentTaskId);
    log.info({ parentTaskId, reviewTaskId, stageId: stage.id }, "Pipeline: triggered review stage");
    return reviewTaskId;
  } catch (err) {
    log.error({ err, parentTaskId }, "Pipeline: failed to trigger review stage");
    return null;
  }
}

/**
 * Trigger a generic pipeline stage (qa, deploy, or custom).
 * Creates a blocking subtask with the stage's agent config.
 */
async function triggerGenericStage(
  parentTaskId: string,
  parentTask: { title: string; repoUrl: string; prompt: string },
  stage: PipelineStage,
): Promise<string | null> {
  const { createSubtask } = await import("./subtask-service.js");
  const { resolveAgentConfig } = await import("./agent-config-resolver.js");
  const { getRepoByUrl, getPipelineStages } = await import("./repo-service.js");

  const repoConfig = await getRepoByUrl(parentTask.repoUrl);
  const pipelineStages = repoConfig ? await getPipelineStages(repoConfig.id) : [];
  const resolved = await resolveAgentConfig(stage.stage, repoConfig, {
    pipelineStages,
  });

  const subtask = await createSubtask({
    parentTaskId,
    title: `${stage.stage}: ${parentTask.title}`,
    prompt: `Run ${stage.stage} stage for: ${parentTask.title}`,
    taskType: stage.stage,
    blocksParent: true,
    agentType: resolved.agentType,
  });

  await taskService.transitionTask(subtask.id, TaskState.QUEUED, `pipeline_stage_${stage.stage}`);
  await taskQueue.add(
    "process-task",
    { taskId: subtask.id },
    {
      jobId: `${subtask.id}`,
      priority: 10,
    },
  );

  log.info(
    { parentTaskId, subtaskId: subtask.id, stage: stage.stage, agentId: resolved.agentId },
    "Pipeline: triggered next stage",
  );
  return subtask.id;
}

function findNextEnabledStage(stages: PipelineStage[], startIdx: number): PipelineStage | null {
  for (let i = startIdx; i < stages.length; i++) {
    if (stages[i].enabled) return stages[i];
  }
  return null;
}
