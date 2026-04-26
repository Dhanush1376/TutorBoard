# Graph Report - TutorBoard  (2026-04-26)

## Corpus Check
- 249 files · ~236,037 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 766 nodes · 897 edges · 26 communities detected
- Extraction: 72% EXTRACTED · 28% INFERRED · 0% AMBIGUOUS · INFERRED: 248 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]

## God Nodes (most connected - your core abstractions)
1. `resolve()` - 30 edges
2. `validateApiKey()` - 27 edges
3. `requestCompletion()` - 24 edges
4. `useAuth()` - 22 edges
5. `SessionStore` - 15 edges
6. `test()` - 14 edges
7. `_executeCustomPath()` - 14 edges
8. `_executeSystemPath()` - 14 edges
9. `RedisClient` - 13 edges
10. `CircuitBreaker` - 12 edges

## Surprising Connections (you probably didn't know these)
- `PrivacySection()` --calls--> `useAuth()`  [INFERRED]
  client\src\components\settings\AccountSection.jsx → client\src\context\AuthContext.jsx
- `AccountSection()` --calls--> `useAuth()`  [INFERRED]
  client\src\components\settings\AccountSection.jsx → client\src\context\AuthContext.jsx
- `testTransientKey()` --calls--> `validateApiKey()`  [INFERRED]
  server\controllers\apikeys.controller.js → server\utils\validation\apiValidator.js
- `test()` --calls--> `validateApiKey()`  [INFERRED]
  scratch_test_validation.mjs → server\utils\validation\apiValidator.js
- `test()` --calls--> `detectProvider()`  [INFERRED]
  scratch_test_validation.mjs → client\src\components\settings\api-config\ProviderRegistry.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (40): CircuitBreaker, runDeltaAgent(), classifyDoubt(), detectIntent(), checkCostLimit(), classifyCustomError(), classifyError(), createTimeoutController() (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (26): AboutSection(), AccountMenu(), APIConfigSection(), App(), useAuth(), ChatLanding(), AvatarCircle(), GeneralSection() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (14): formatStandardOutput(), generateResponse(), generateResponse(), generateResponse(), MatterRenderer(), generateResponse(), checkGuestUsage(), checkSocketRate() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (32): CartesianAxes(), DiamondShape(), EllipseShape(), GeometryPolygon(), GlassEllipse(), GlassRect(), GlowOrb(), HexagonShape() (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (15): AppearanceSection(), AuthProvider(), CodeVisualizerModal(), executeCode(), executeJavaScript(), executePistonAPI(), executePythonLocal(), GET_TOKEN_COLORS() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (17): replanRemainingSteps(), classifyDeep(), classifyFast(), planAnimation(), detectDomains(), getAnimationGuide(), getDomainConfig(), getDomainMeta() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (15): addApiKey(), getApiKeyDashboard(), getHealthStatus(), testApiKey(), testTransientKey(), updateApiKey(), decrypt(), encrypt() (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (15): exchangeToken(), generateToken(), sanitize(), signin(), signup(), socialLoginSuccess(), optionalProtect(), protect() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (22): testAI21(), testAnthropic(), testCerebras(), testCohere(), testCustom(), testDeepSeek(), testElevenLabs(), testGenericOpenAI() (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (13): AccountSection(), getStrength(), PasswordStrengthBar(), PrivacySection(), detectProviderFromKey(), AuthLanding(), isOriginAllowed(), detectProvider() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (11): getAdaptiveScores(), generateExplanation(), isValidInput(), sanitizeInput(), sanitizeText(), classifyTask(), selectOptimalModel(), getIp() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (9): extractJSON(), fixObjectIds(), getUserContext(), runAgentLoop(), runStage(), unwrapValidatorOutput(), validateSceneGraph(), getPrompt() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (3): resetPostHog(), trackEvent(), CanvasStateSnapshot

### Community 14 - "Community 14"
Cohesion: 0.31
Nodes (4): getCfg(), parseMicroSteps(), StepPanel(), useTypewriter()

### Community 15 - "Community 15"
Cohesion: 0.36
Nodes (2): cosineSimilarity(), TopicCache

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (2): validateAvatarUrl(), updateSettings()

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (1): BoardErrorBoundary

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (1): GSAPExecutor

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (2): InlineEditor(), useClickOutside()

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (3): routeRequest(), resolveModel(), withRetry()

### Community 26 - "Community 26"
Cohesion: 0.53
Nodes (4): attachRequestIdToSocket(), generateRequestId(), getOrCreateRequestId(), requestIdMiddleware()

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (3): ColorPicker(), resolveColor(), DrawTool()

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (2): AgentCanvasRenderer(), getRenderer()

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (1): IntroAnimation()

## Knowledge Gaps
- **Thin community `Community 15`** (9 nodes): `cosineSimilarity()`, `TopicCache`, `.clear()`, `.constructor()`, `._estimateSize()`, `.get()`, `._normalize()`, `.set()`, `cache.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (8 nodes): `validateAvatarUrl()`, `user.controller.js`, `securityValidators.js`, `deleteAccount()`, `exportData()`, `updatePassword()`, `updateSettings()`, `wipeCloudData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (7 nodes): `Board()`, `BoardErrorBoundary`, `.componentDidCatch()`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`, `Board.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (6 nodes): `main.jsx`, `ErrorBoundary`, `.componentDidCatch()`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (6 nodes): `ErrorBoundary.jsx`, `ErrorBoundary`, `.componentDidCatch()`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (6 nodes): `GSAPExecutor.js`, `GSAPExecutor`, `.constructor()`, `.killAll()`, `.mapEase()`, `.run()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (6 nodes): `InlineEditor.jsx`, `useClickOutside.js`, `CodeModalEditor()`, `InlineEditor()`, `MathInsideEditor()`, `useClickOutside()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `AgentCanvasRenderer()`, `AgentCanvasRenderer.jsx`, `RendererRouter.js`, `getRenderer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (3 nodes): `IntroAnimation.jsx`, `IntroAnimation()`, `IntroAnimation.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `test()` connect `Community 9` to `Community 0`, `Community 6`, `Community 7`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 1` to `Community 9`, `Community 4`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `AuthLanding()` connect `Community 9` to `Community 1`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `resolve()` (e.g. with `GlowOrb()` and `GlassRect()`) actually correct?**
  _`resolve()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `validateApiKey()` (e.g. with `test()` and `addApiKey()`) actually correct?**
  _`validateApiKey()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `requestCompletion()` (e.g. with `runDeltaAgent()` and `classifyDoubt()`) actually correct?**
  _`requestCompletion()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `useAuth()` (e.g. with `App()` and `ProtectedRoute()`) actually correct?**
  _`useAuth()` has 21 INFERRED edges - model-reasoned connections that need verification._