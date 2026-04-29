# Changelog

## [0.1.1](https://github.com/TheDeltaLab/synapse/compare/0.1.0...0.1.1) (2026-04-29)


### Features

* **analytics:** add analytics overview page ([067e28f](https://github.com/TheDeltaLab/synapse/commit/067e28f256ae4144456ccd7bcdc9b897e57769b8))
* **analytics:** add filtered chat and embedding analytics ([#46](https://github.com/TheDeltaLab/synapse/issues/46)) ([cdff3d3](https://github.com/TheDeltaLab/synapse/commit/cdff3d326f274644b060aea60187ed98632f6a57))
* **cache:** add azure redis support ([#35](https://github.com/TheDeltaLab/synapse/issues/35)) ([d4433a3](https://github.com/TheDeltaLab/synapse/commit/d4433a3f371d9790176db519a35890915e7b50d5))
* **cache:** add LLM response caching via Redis and AI SDK middleware ([#20](https://github.com/TheDeltaLab/synapse/issues/20)) ([0a1e172](https://github.com/TheDeltaLab/synapse/commit/0a1e1723c6461d356ec78ccb8c7210beebe93630))
* **chat:** add response adapter to support different response style ([9455828](https://github.com/TheDeltaLab/synapse/commit/9455828045d6686111f0b606fad0d9ddd5967cb5))
* **ci:** change the behavior of release-please ([3590ca2](https://github.com/TheDeltaLab/synapse/commit/3590ca2a171b1a29ca2aa4d2a7d501277906db20))
* **dashboard,gateway,mock:** migrate to AI SDK, add Anthropic models, and mock auth ([#32](https://github.com/TheDeltaLab/synapse/issues/32)) ([ebb4800](https://github.com/TheDeltaLab/synapse/commit/ebb4800df78ea9224db4b390dd241d1c93fbc4c4))
* **dashboard:** add user auth system to prevent unauthed request ([#9](https://github.com/TheDeltaLab/synapse/issues/9)) ([75ce4b4](https://github.com/TheDeltaLab/synapse/commit/75ce4b4494519b2841b5bfac73f89401ed8a4623))
* **dashboard:** init dashboard ([0f1d8cd](https://github.com/TheDeltaLab/synapse/commit/0f1d8cd47e2d3847f5e62aac86581421591f219d))
* **embedding:** add Alibaba DashScope text-embedding-v4 provider ([#39](https://github.com/TheDeltaLab/synapse/issues/39)) ([31b5d57](https://github.com/TheDeltaLab/synapse/commit/31b5d5768f78050a9da7ee7b657a6188c039d9fd))
* **embedding:** add embedding interface ([#10](https://github.com/TheDeltaLab/synapse/issues/10)) ([400d6c1](https://github.com/TheDeltaLab/synapse/commit/400d6c1bab0c6bb4c49efd114ede6fb5fbc53b9b))
* **embedding:** add qwen/qwen3-embedding-4b model via OpenRouter ([#42](https://github.com/TheDeltaLab/synapse/issues/42)) ([a7ab4da](https://github.com/TheDeltaLab/synapse/commit/a7ab4da577477438bc10bac75cbcb95ac9b7aeae))
* **gateway,dashboard:** manage gateway and dashboard by release-please with docker ([#3](https://github.com/TheDeltaLab/synapse/issues/3)) ([aee47b0](https://github.com/TheDeltaLab/synapse/commit/aee47b0f9e1bd577058fee0097ff85b3d4a2e9ba))
* **gateway:** add OpenTelemetry tracing with W3C traceparent propagation ([#41](https://github.com/TheDeltaLab/synapse/issues/41)) ([904662b](https://github.com/TheDeltaLab/synapse/commit/904662bd17becd278178478d5e591714d6b40eee))
* **gateway:** init gateway ([6c3338c](https://github.com/TheDeltaLab/synapse/commit/6c3338c0754e0a4b8638bf3f893b61df41d15bab))
* **gateway:** init the gateway ([30fcef4](https://github.com/TheDeltaLab/synapse/commit/30fcef4510cf81e9c5f2df6be8bf0b07b9f2c586))
* **gateway:** init the gateway [#2](https://github.com/TheDeltaLab/synapse/issues/2) ([30fcef4](https://github.com/TheDeltaLab/synapse/commit/30fcef4510cf81e9c5f2df6be8bf0b07b9f2c586))
* **gateway:** refactor to transparent reverse proxy ([#30](https://github.com/TheDeltaLab/synapse/issues/30)) ([e254edb](https://github.com/TheDeltaLab/synapse/commit/e254edb09de65df329c3f0450c5cc4480585926f))
* **gateway:** transparent reverse proxy with per-request cache bypass ([#31](https://github.com/TheDeltaLab/synapse/issues/31)) ([c820176](https://github.com/TheDeltaLab/synapse/commit/c8201763ee3f0b03e2acbcae1bff6372b602afb4))
* **infra:** add AKS deployment with merlin resources and CI/CD workflow ([#37](https://github.com/TheDeltaLab/synapse/issues/37)) ([9509d1d](https://github.com/TheDeltaLab/synapse/commit/9509d1dafcdf99c1dcafa6cf7f034e86e9dd09e4))
* **keys:** add versions in api keys ([229f740](https://github.com/TheDeltaLab/synapse/commit/229f740271c819347ba74a0cebe2e62a73cd4fcc))
* **mock:** add mock server for local test ([#8](https://github.com/TheDeltaLab/synapse/issues/8)) ([404d9c1](https://github.com/TheDeltaLab/synapse/commit/404d9c1a9796f95043dd458046ceac0e44510992))
* **playground:** chat with playground ([30143d6](https://github.com/TheDeltaLab/synapse/commit/30143d63bc6a9f9338d23da4bf55eec72314f0e7))
* **provider:** add Alibaba qwen3.5-omni-plus with multi-modal audio support ([#49](https://github.com/TheDeltaLab/synapse/issues/49)) ([6bc2ba3](https://github.com/TheDeltaLab/synapse/commit/6bc2ba3c39e4e04315f0b9bb94eb726d48014bda))
* **provider:** add Anthropic Claude 4.x models via OpenRouter ([#48](https://github.com/TheDeltaLab/synapse/issues/48)) ([e496a0e](https://github.com/TheDeltaLab/synapse/commit/e496a0eaefaec4b117014e186b265136ca523c58))
* **provider:** support deepseek ([#29](https://github.com/TheDeltaLab/synapse/issues/29)) ([541d7f3](https://github.com/TheDeltaLab/synapse/commit/541d7f334c6560beb6ec20b43882547fa7c99f5c))


### Bug Fixes

* **ci:** add missed tsconfig.base.json ([4d2fa03](https://github.com/TheDeltaLab/synapse/commit/4d2fa03df9efd225f6d79262d73d96af10e04298))
* **ci:** update docker file to fix build ([#5](https://github.com/TheDeltaLab/synapse/issues/5)) ([2d56e6f](https://github.com/TheDeltaLab/synapse/commit/2d56e6f51180f86bbccb67c38e369d40c7540750))
* **dashboard:** fix analytics and logs page ([#7](https://github.com/TheDeltaLab/synapse/issues/7)) ([db7024f](https://github.com/TheDeltaLab/synapse/commit/db7024fd0b07f0c535266f990d0406c4db139193))
* **dashboard:** fix logs page 404 error ([#21](https://github.com/TheDeltaLab/synapse/issues/21)) ([23def27](https://github.com/TheDeltaLab/synapse/commit/23def27ce250b216c317cd083186f82378f45a86))
* **dashboard:** remove duplicate cache toggle in embedding playground ([#44](https://github.com/TheDeltaLab/synapse/issues/44)) ([9dbb40b](https://github.com/TheDeltaLab/synapse/commit/9dbb40b3d9921cf6be21a3c5e82a758963bd82fb))
* **deploy:** Chuang/fix/build pipeline no containerappenv ([#15](https://github.com/TheDeltaLab/synapse/issues/15)) ([9b78133](https://github.com/TheDeltaLab/synapse/commit/9b781336052a3838e0d3aa3ec94924f6bd3e0bbd))
* **docker:** fix docker build error ([#12](https://github.com/TheDeltaLab/synapse/issues/12)) ([a6b4b9e](https://github.com/TheDeltaLab/synapse/commit/a6b4b9e0c29dc0cf3b902af390c61ec638a7c470))
* **docker:** fix docker build file ([#11](https://github.com/TheDeltaLab/synapse/issues/11)) ([eac3549](https://github.com/TheDeltaLab/synapse/commit/eac35497bbf04db9e904b2287e2dfeb0f962d6a2))
* **gateway:** add @synapse/observability to dev scripts, Dockerfile, and CI ([#43](https://github.com/TheDeltaLab/synapse/issues/43)) ([ed4564f](https://github.com/TheDeltaLab/synapse/commit/ed4564f69671ab15f5dc09cbf19ce951a8caf4cc))
* **gateway:** fix build error ([1f85508](https://github.com/TheDeltaLab/synapse/commit/1f8550844d1a60afd3a357b5f3f6490c8e5dcdeb))
* **gateway:** improve Redis reconnection and cache observability ([#34](https://github.com/TheDeltaLab/synapse/issues/34)) ([3302b88](https://github.com/TheDeltaLab/synapse/commit/3302b88b72b4bf0ab7388fa5046cfa13950205dc))
* **requestLog:** fix the request logs on token usage ([90bac67](https://github.com/TheDeltaLab/synapse/commit/90bac6718cb1f73cf39f6eeb8bf660c9dbca3e32))
