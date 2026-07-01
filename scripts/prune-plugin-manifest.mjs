#!/usr/bin/env node
// Prune ECC plugin surface: explicit skills/commands lists in plugin.json,
// move cut agents to agents-disabled/. Cut-list driven: new upstream items
// default to INCLUDED (visible on next regen).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ECC = '/Users/tox/code/tox/ECC';

const CUT_SKILLS = new Set([
  // marketing / social / content
  'article-writing','brand-discovery','brand-voice','competitive-platform-analysis',
  'competitive-report-structure','content-engine','crosspost','investor-materials',
  'investor-outreach','lead-intelligence','market-research','marketing-campaign','seo',
  'social-graph-ranker','social-publisher','x-api',
  // business / logistics / supply chain
  'carrier-relationship-management','customs-trade-compliance','customer-billing-ops',
  'energy-procurement','finance-billing-ops','inventory-demand-planning',
  'logistics-exception-management','production-scheduling','quality-nonconformance',
  'returns-reverse-logistics',
  // healthcare
  'healthcare-cdss-patterns','healthcare-emr-patterns','healthcare-eval-harness',
  'healthcare-phi-compliance','hipaa-compliance',
  // homelab / network
  'homelab-network-readiness','homelab-network-setup','homelab-pihole-dns',
  'homelab-vlan-segmentation','homelab-wireguard-vpn','cisco-ios-patterns',
  'netmiko-ssh-automation','network-bgp-diagnostics','network-config-validation',
  'network-interface-health',
  // crypto / trading
  'ito-basket-compare','ito-data-atlas-agent','ito-market-intelligence','ito-trade-planner',
  'prediction-market-oracle-research','prediction-market-risk-review','defi-amm-security',
  'evm-token-decimals','llm-trading-agent-security','nodejs-keccak256','agent-payment-x402',
  // media / video
  'blender-motion-state-inspection','fal-ai-media','manim-video','remotion-video-creation',
  'video-editing','videodb','frontend-slides',
  // scientific
  'scientific-db-pubmed-database','scientific-db-uspto-database','scientific-pkg-gget',
  'scientific-thinking-literature-review','scientific-thinking-scholar-evaluation',
  // personal / comms ops
  'email-ops','messages-ops','google-workspace-ops','unified-notifications-ops',
  'project-flow-ops','knowledge-ops','research-ops','automation-audit-ops',
  'workspace-surface-audit','connections-optimizer','visa-doc-translate',
  'nutrient-document-processing',
  // stacks not used
  'angular-developer','csharp-testing','dotnet-patterns','fsharp-testing',
  'java-coding-standards','jpa-patterns','perl-patterns','perl-security','perl-testing',
  'laravel-patterns','laravel-plugin-discovery','laravel-security','laravel-tdd',
  'laravel-verification','django-celery','django-patterns','django-security','django-tdd',
  'django-verification','quarkus-patterns','quarkus-security','quarkus-tdd',
  'quarkus-verification','springboot-patterns','springboot-security','springboot-tdd',
  'springboot-verification','tinystruct-patterns','cpp-coding-standards','cpp-testing',
  'dart-flutter-patterns','flutter-dart-code-review','windows-desktop-e2e','hermes-imports',
  'foundation-models-on-device',
  // ML (no evidence of use)
  'pytorch-patterns','mle-workflow','ml-adoption-playbook','recsys-pipeline-architect',
  // niche / vendor / fringe
  'exa-search','jira-integration','clickhouse-io','flox-environments','uncloud',
  'canary-watch','dashboard-builder','data-scraper-agent','data-throughput-accelerator',
  'click-path-audit','product-lens','product-capability','enterprise-agent-ops',
  'nanoclaw-repl','openclaw-persona-forge','ralphinho-rfc-pipeline','deep-research',
  'api-connector-builder',
]);

const CUT_COMMANDS = new Set([
  'cpp-build.md','cpp-review.md','cpp-test.md',
  'flutter-build.md','flutter-review.md','flutter-test.md',
  'jira.md','marketing-campaign.md',
  'epic-claim.md','epic-decompose.md','epic-publish.md','epic-review.md',
  'epic-sync.md','epic-unblock.md','epic-validate.md',
  'pm2.md','setup-pm.md',
  'multi-backend.md','multi-execute.md','multi-frontend.md','multi-plan.md','multi-workflow.md',
]);

const CUT_AGENTS = new Set([
  'chief-of-staff.md','cpp-build-resolver.md','cpp-reviewer.md','csharp-reviewer.md',
  'dart-build-resolver.md','django-build-resolver.md','django-reviewer.md',
  'flutter-reviewer.md','fsharp-reviewer.md','harmonyos-app-resolver.md',
  'healthcare-reviewer.md','homelab-architect.md','java-build-resolver.md',
  'java-reviewer.md','marketing-agent.md','mle-reviewer.md','network-architect.md',
  'network-config-reviewer.md','network-troubleshooter.md','php-reviewer.md',
  'pytorch-build-resolver.md','seo-specialist.md',
]);

const skills = readdirSync(join(ECC, 'skills'), { withFileTypes: true })
  .filter(d => d.isDirectory() && !CUT_SKILLS.has(d.name))
  .map(d => `./skills/${d.name}/`).sort();
const commands = readdirSync(join(ECC, 'commands'))
  .filter(f => f.endsWith('.md') && !CUT_COMMANDS.has(f))
  .map(f => `./commands/${f}`).sort();

// warn on cut-list entries that no longer exist upstream (in active OR parked dir)
const allSkills = new Set(readdirSync(join(ECC, 'skills')));
const allCmds = new Set(readdirSync(join(ECC, 'commands')));
const parked = p => existsSync(join(ECC, p));
for (const s of CUT_SKILLS) if (!allSkills.has(s) && !parked(`skills-disabled/${s}`)) console.log(`WARN cut skill missing upstream: ${s}`);
for (const c of CUT_COMMANDS) if (!allCmds.has(c)) console.log(`WARN cut command missing upstream: ${c}`);

const manifest = JSON.parse(readFileSync(join(ECC, '.claude-plugin/plugin.json'), 'utf8'));
// skills: MUST stay the convention dir. An explicit per-skill entry list broke
// skill loading entirely (fresh session lost ALL ecc skills, kept ones too).
// commands: explicit file list DOES filter — verified in a fresh session.
manifest.skills = ['./skills/'];
manifest.commands = commands;
writeFileSync(join(ECC, '.claude-plugin/plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

// skills + agents are auto-discovered from skills/ and agents/ by convention —
// the manifest list does NOT filter them (verified empirically: a fresh
// session still listed cut skills). Physically park cut ones outside the
// scanned dirs; that parking is the real filter.
const skillsDisabled = join(ECC, 'skills-disabled');
mkdirSync(skillsDisabled, { recursive: true });
let movedSkills = 0;
for (const s of CUT_SKILLS) {
  const src = join(ECC, 'skills', s);
  if (existsSync(src)) { renameSync(src, join(skillsDisabled, s)); movedSkills++; }
}

const disabledDir = join(ECC, 'agents-disabled');
mkdirSync(disabledDir, { recursive: true });
let moved = 0;
for (const f of CUT_AGENTS) {
  const src = join(ECC, 'agents', f);
  if (existsSync(src)) { renameSync(src, join(disabledDir, f)); moved++; }
  else if (!parked(`agents-disabled/${f}`)) console.log(`WARN cut agent missing: ${f}`);
}

console.log(`skills kept: ${skills.length}/${allSkills.size} (moved ${movedSkills} to skills-disabled/)`);
console.log(`commands kept: ${commands.length}`);
console.log(`agents moved to agents-disabled/: ${moved}`);
