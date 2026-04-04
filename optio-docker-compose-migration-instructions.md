# Optio 포크: Kubernetes → Docker Compose 전환 작업 지시서

## 배경 및 목적

나는 AI 코딩 에이전트를 이용한 개발 자동화 파이프라인을 구축하려고 한다.
"GitHub Issue가 생기면 AI가 알아서 가져가서 구현하고, PR 만들고, CI 실패하면 자동 수정하고, 리뷰 피드백도 반영하고, 최종적으로 merge까지 하는" 풀 오토 워크플로가 목표다.

이 목적에 가장 가까운 오픈소스 프로젝트가 **Optio** (https://github.com/jonwiggins/optio)인데,
Optio는 Kubernetes 기반으로 설계되어 있어서 개인/소규모 팀이 쓰기에는 인프라 부담이 크다.

**따라서 Optio를 포크하여 Kubernetes 의존성을 Docker Compose 기반으로 교체하는 것이 이 작업의 핵심이다.**

추가로, Claude API를 직접 호출하는 대신 **Claude Code가 설치된 머신에서 `claude -p` (headless mode)로 실행**하는 방식도 지원하고 싶다. 이렇게 하면 Claude Pro/Max 구독 내에서 별도 API 비용 없이 사용할 수 있다.

---

## 브랜치 분리하기

main은 업스트림과의 연결(원본)으로 두기 위해 icehood라는 별도 branch를 만들어서 해당 브랜치에서만 작업한다.

---

## Optio의 현재 아키텍처 (변경 전)

```
┌──────────────┐   ┌────────────────────┐   ┌───────────────────────────┐
│   Web UI     │──→│   API Server       │──→│   Kubernetes              │
│   Next.js    │   │   Fastify          │   │                           │
│   :3100      │   │                    │   │  ┌── Repo Pod A ────────┐ │
│              │←ws│   Workers:         │   │  │  clone + sleep       │ │
│  Dashboard   │   │   ├─ Task Queue    │   │  │  ├─ worktree 1 ⚡   │ │
│  Tasks       │   │   ├─ PR Watcher    │   │  │  ├─ worktree 2 ⚡   │ │
│  Repos       │   │   ├─ Health Mon    │   │  │  └─ worktree N ⚡   │ │
│  Costs       │   │   └─ Ticket Sync   │   │  └─────────────────────┘ │
└──────────────┘   └─────────┬──────────┘   └───────────────────────────┘
                             │                  ⚡ = Claude Code / Codex
                      ┌──────┴──────┐
                      │  Postgres   │
                      │  + Redis    │
                      └─────────────┘
```

### 디렉토리 구조

```
optio/
├── apps/
│   ├── api/          # Fastify API 서버, BullMQ 워커, WebSocket, 리뷰 서비스, OAuth
│   └── web/          # Next.js 대시보드 (실시간 스트리밍, 비용 분석)
├── packages/
│   ├── shared/       # 타입, 태스크 상태 머신, 프롬프트 템플릿, 에러 분류기
│   ├── container-runtime/  # ⚠️ K8s Pod 라이프사이클, exec, 로그 스트리밍
│   ├── agent-adapters/     # Claude Code + Codex + Copilot 어댑터
│   └── ticket-providers/   # GitHub Issues, Linear, Jira, Notion
├── images/           # 컨테이너 Dockerfile: base, node, python, go, rust, full
├── helm/optio/       # ⚠️ Helm 차트 (K8s 배포용)
└── scripts/          # 셋업, 초기화, 엔트리포인트 스크립트
```

### 핵심 동작 흐름

1. **Intake**: GitHub Issue 할당 / Linear / Jira / Notion / 웹 UI에서 태스크 생성
2. **Provisioning**: 해당 repo용 K8s Pod를 찾거나 생성, git worktree로 격리
3. **Execution**: AI 에이전트 (Claude Code / Codex / Copilot) 실행
4. **PR lifecycle**: PR 생성 후 30초마다 CI 상태, 리뷰 상태, merge 가능 여부 폴링
5. **Feedback loop**: CI 실패 → 에이전트 자동 재개 (실패 컨텍스트 주입), 리뷰 피드백 → 에이전트 재개
6. **Completion**: squash-merge + 연결된 이슈 close + 비용 기록

---

## 변경 목표 (변경 후)

```
┌──────────────┐   ┌────────────────────┐   ┌───────────────────────────┐
│   Web UI     │──→│   API Server       │──→│   Docker Compose          │
│   Next.js    │   │   Fastify          │   │                           │
│   :3100      │   │                    │   │  ┌── Worker Container ──┐ │
│              │←ws│   Workers:         │   │  │  Claude Code 설치됨   │ │
│  Dashboard   │   │   ├─ Task Queue    │   │  │  ├─ worktree 1 ⚡   │ │
│  Tasks       │   │   ├─ PR Watcher    │   │  │  ├─ worktree 2 ⚡   │ │
│  Repos       │   │   ├─ Health Mon    │   │  │  └─ worktree N ⚡   │ │
│  Costs       │   │   └─ Ticket Sync   │   │  └─────────────────────┘ │
└──────────────┘   └─────────┬──────────┘   └───────────────────────────┘
                             │                  ⚡ = claude -p (headless)
                      ┌──────┴──────┐
                      │  Postgres   │
                      │  + Redis    │
                      └─────────────┘
```

### 핵심 변경 사항

| 영역                          | 변경 전 (K8s)                              | 변경 후 (Docker Compose)                        |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------- |
| 컨테이너 오케스트레이션       | K8s Pod 생성/삭제/관리                     | `docker compose` 서비스로 관리                  |
| `packages/container-runtime/` | K8s API (kubectl, @kubernetes/client-node) | Docker API (dockerode 또는 docker compose exec) |
| `helm/optio/`                 | Helm 차트                                  | `docker-compose.yml`                            |
| Pod 프로비저닝                | K8s Pod 스케줄링                           | docker compose로 워커 컨테이너 관리             |
| exec (에이전트 실행)          | `kubectl exec` into Pod                    | `docker compose exec` 또는 `docker exec`        |
| 로그 스트리밍                 | K8s Pod 로그 API                           | Docker 로그 API (`docker logs -f`)              |
| 헬스 체크                     | K8s Pod 상태                               | Docker 컨테이너 healthcheck                     |
| 스케일링                      | K8s replica 조정                           | `docker compose up --scale worker=N`            |
| 에이전트 실행                 | Claude API 직접 호출                       | `claude -p` (headless, CLI) 모드                |

---

## 세부 작업 지시

### 1단계: 프로젝트 구조 분석

먼저 아래 파일/디렉토리를 읽고 K8s 의존성이 어디에 있는지 파악해라:

- `packages/container-runtime/` — 이 패키지가 K8s와 가장 강하게 결합되어 있을 것이다. Pod 생성, exec, 로그 스트리밍, 헬스 체크 로직이 여기에 있다.
- `helm/optio/` — Helm 차트. docker-compose.yml로 대체해야 한다.
- `apps/api/` — API 서버가 container-runtime 패키지를 어떻게 호출하는지 확인해라. 인터페이스가 어떻게 생겼는지가 중요하다.
- `packages/agent-adapters/` — Claude Code 어댑터가 에이전트를 어떻게 실행하는지 확인해라. API 호출 방식인지, CLI 실행 방식인지.
- `images/` — 기존 Dockerfile들. 이 이미지들은 그대로 활용할 수 있을 것이다.
- `scripts/` — 엔트리포인트 스크립트. Docker 환경에 맞게 수정이 필요할 수 있다.

### 2단계: container-runtime 패키지 교체

이것이 핵심 작업이다. `packages/container-runtime/`의 K8s 의존성을 Docker API로 교체해라.

**인터페이스는 최대한 유지하되, 구현만 바꿔라.** API 서버 쪽 코드 변경을 최소화하기 위함이다.

교체 대상:

- **Pod 프로비저닝** → Docker 컨테이너 생성/시작/중지. `dockerode` npm 패키지를 사용하거나, Docker CLI를 child_process로 호출해라.
- **exec (명령 실행)** → `docker exec <container> bash -c "..."`. 에이전트를 실행할 때 `claude -p "프롬프트"` 형태로 호출.
- **로그 스트리밍** → `docker logs -f <container>` 또는 dockerode의 로그 스트림 API.
- **헬스 모니터링** → `docker inspect` 또는 Docker healthcheck.
- **worktree 격리** → 기존 git worktree 방식은 그대로 유지. 컨테이너 안에서 동작하므로 변경 불필요.

### 3단계: docker-compose.yml 생성

`helm/optio/` 대신 프로젝트 루트에 `docker-compose.yml`을 만들어라.

필요한 서비스:

```yaml
services:
  api: # Fastify API 서버
  web: # Next.js 대시보드
  worker: # Claude Code가 설치된 워커 컨테이너 (스케일 가능)
  postgres: # PostgreSQL
  redis: # Redis (BullMQ용)
```

worker 서비스 요구사항:

- Claude Code (`@anthropic-ai/claude-code`) 전역 설치
- Git, gh CLI 설치
- Node.js 22+
- SSH 서버 (선택사항, 외부에서 직접 접근 시)
- 볼륨: 워크스페이스 디렉토리를 마운트하여 repo 클론 유지
- 환경변수: `ANTHROPIC_API_KEY` 또는 Claude Code 인증 정보

### 4단계: 에이전트 어댑터 수정 (claude -p 모드 지원)

`packages/agent-adapters/`의 Claude Code 어댑터를 수정하여 두 가지 모드를 지원해라:

**모드 A: claude -p (headless CLI) — 기본값**

```bash
docker exec worker bash -c "
  cd /workspace/repo-name && \
  git checkout -b claude/issue-42 main && \
  claude -p '이슈 #42 내용: {description}. 구현하고 테스트 작성하고 커밋해.' \
    --allowedTools 'Read,Write,Edit,Bash' \
    --dangerously-skip-permissions \
    --output-format json
"
```

- Claude Pro/Max 구독 사용, API 비용 별도 없음
- `--output-format json`으로 결과를 구조화해서 받기

**모드 B: Claude API 직접 호출 — 기존 방식 유지**

- 기존 Optio의 API 호출 방식 그대로 남겨둬라
- 설정으로 모드 A / 모드 B 전환 가능하게

### 5단계: Helm 관련 코드 정리

- `helm/optio/` 디렉토리는 삭제하지 말고, `helm-legacy/` 등으로 이름 변경하여 보존
- 프로젝트 루트의 README에 Docker Compose 기반 설치 방법을 기본으로 안내
- K8s 사용자를 위한 기존 Helm 차트도 참조 가능하도록 유지

### 6단계: 테스트 및 검증

아래 시나리오를 순서대로 테스트해라:

1. `docker compose up -d` 로 전체 스택 기동
2. 웹 UI (localhost:3100) 접속하여 repo 등록
3. GitHub Issue에 특정 라벨 (예: `optio`) 붙이기
4. Optio가 자동으로 이슈를 감지하고 워커 컨테이너에서 `claude -p` 실행하는지 확인
5. PR이 자동 생성되는지 확인
6. 의도적으로 CI를 실패시키고, 에이전트가 자동 재개하여 수정하는지 확인
7. PR 코멘트로 리뷰 피드백을 남기고, 에이전트가 반영하는지 확인
8. 모든 체크 통과 후 자동 merge 되는지 확인

---

## 주의사항

1. **인터페이스 보존 원칙**: container-runtime 패키지의 외부 인터페이스 (함수 시그니처, 타입)를 최대한 보존해라. API 서버와 워커 코드 수정을 최소화하기 위함이다.

2. **점진적 교체**: 한 번에 모든 것을 바꾸지 말고, container-runtime의 함수를 하나씩 Docker 버전으로 교체하면서 테스트해라.

3. **K8s 코드 삭제하지 마라**: K8s 구현은 별도 파일이나 전략 패턴으로 분리하여, 나중에 K8s를 쓰고 싶을 때 다시 활성화할 수 있게 해라. 예: `DockerContainerRuntime` / `K8sContainerRuntime` 클래스로 분리.

4. **claude -p의 제약**:
   - `--dangerously-skip-permissions` 플래그가 필요하다 (자동화 환경이므로)
   - 출력이 길 수 있으므로 `--output-format json` 사용을 권장
   - 세션 간 상태가 유지되지 않으므로, 피드백 루프에서 재실행 시 이전 컨텍스트를 프롬프트에 포함해야 한다
   - Claude Code 인증이 컨테이너 안에서 유지되어야 한다 (API 키 환경변수 또는 `claude /login`으로 사전 인증)

5. **Docker 소켓 마운트**: API 서버 컨테이너가 Docker를 제어해야 하므로, `/var/run/docker.sock`을 마운트하거나 Docker-in-Docker (DinD)를 사용해야 할 수 있다. 보안 관점에서 DinD보다는 소켓 마운트가 단순하다.

6. **기존 images/ 활용**: Optio의 `images/` 디렉토리에 이미 node, python, go, rust 등 다양한 Dockerfile이 있다. 이 이미지들에 Claude Code를 추가로 설치하는 레이어를 덧씌우는 방식이 가장 깔끔하다.

---

## 참고 리소스

- Optio 원본: https://github.com/jonwiggins/optio
- Claude Code headless mode: https://code.claude.com/docs/en/headless
- Claude Code VPS 셋업 가이드: https://claudefa.st/blog/guide/development/infraops-vps-guide
- n8n + Claude Code SSH 연동: https://github.com/theNetworkChuck/n8n-claude-code-guide
- Claude Agent SDK (Python/TS): https://github.com/anthropics/claude-agent-sdk-python
- dockerode (Node.js Docker API): https://github.com/apocas/dockerode

---

## 완료 기준

- [ ] `docker compose up -d` 한 줄로 전체 스택 (API + Web + Worker + Postgres + Redis) 기동
- [ ] GitHub Issue 할당 시 자동으로 워커 컨테이너에서 `claude -p` 실행
- [ ] PR 자동 생성 + CI 폴링 + 실패 시 자동 재시도
- [ ] 리뷰 피드백 자동 반영
- [ ] CI 통과 + Approved 시 자동 merge + 이슈 close
- [ ] K8s 코드는 삭제하지 않고 전략 패턴으로 분리하여 선택 가능
- [ ] README에 Docker Compose 기반 Quick Start 추가
