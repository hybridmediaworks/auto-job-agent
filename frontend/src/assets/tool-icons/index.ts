/**
 * Unified tool icon registry — organized by tech stack category.
 *
 * Each entry: { path: SVG path string, hex: brand color, bg?: override bg, textColor?: icon fill }
 *
 * Categories:
 *   ai.ts       — AI/ML: TensorFlow, PyTorch, NumPy, Pandas, scikit-learn, HuggingFace…
 *   python.ts   — Python ecosystem: Django, Flask, FastAPI, Jupyter, Anaconda…
 *   mern.ts     — MERN stack: MongoDB, Express, React, Node.js…
 *   frontend.ts — Frontend: Vue, Angular, Svelte, Tailwind, CSS, HTML…
 *   wordpress.ts— WordPress: PHP, WooCommerce, Elementor…
 *   devops.ts   — DevOps: Docker, Kubernetes, Git, GitHub, Jenkins, Nginx…
 *   cloud.ts    — Cloud: GCP, Firebase, Vercel, Netlify, Supabase…
 *   database.ts — Databases: MySQL, PostgreSQL, Redis, Elasticsearch…
 *   mobile.ts   — Mobile: Flutter, Kotlin, Swift, Android, React Native…
 *   collab.ts   — Collaboration: Jira, Notion, Figma, Trello, Asana…
 */

import { ICON_ALIASES } from './aliases'
export { ICON_ALIASES }
import ai from './ai'
import python from './python'
import mern from './mern'
import frontend from './frontend'
import wordpress from './wordpress'
import devops from './devops'
import cloud from './cloud'
import database from './database'
import mobile from './mobile'
import collab from './collab'
import generated from './generated'
import awsServices from './aws-services'

export type IconEntry = { path: string; hex: string; bg?: string; textColor?: string }

/**
 * Fallback entries for brands NOT in simple-icons (AWS, Azure, Slack, Adobe, etc.)
 * These render as colored boxes with abbreviated text.
 */
export type FallbackEntry = { bg: string; textColor?: string; abbr: string }

export const FALLBACK_BRANDS: Record<string, FallbackEntry> = {
  // AWS / Amazon — generic
  aws:                      { bg: '#232f3e', abbr: 'AWS' },
  amazon:                   { bg: '#232f3e', abbr: 'AWS' },
  'amazon web services':    { bg: '#232f3e', abbr: 'AWS' },
  // S3 / Storage
  's3':                     { bg: '#569A31', abbr: 'S3' },
  'amazon s3':              { bg: '#569A31', abbr: 'S3' },
  // Compute
  'amazon ec2':             { bg: '#FF9900', textColor: '#000', abbr: 'EC2' },
  'ec2':                    { bg: '#FF9900', textColor: '#000', abbr: 'EC2' },
  'amazon lambda':          { bg: '#FF9900', textColor: '#000', abbr: 'λ' },
  'lambda':                 { bg: '#FF9900', textColor: '#000', abbr: 'λ' },
  'amazon ecs':             { bg: '#FF9900', textColor: '#000', abbr: 'ECS' },
  'amazon eks':             { bg: '#FF9900', textColor: '#000', abbr: 'EKS' },
  'amazon ecr':             { bg: '#FF9900', textColor: '#000', abbr: 'ECR' },
  // Database
  'amazon dynamodb':        { bg: '#4053D6', abbr: 'DDB' },
  'dynamodb':               { bg: '#4053D6', abbr: 'DDB' },
  'amazon rds':             { bg: '#527FFF', abbr: 'RDS' },
  'amazon aurora':          { bg: '#527FFF', abbr: 'Au' },
  'amazon redshift':        { bg: '#8C4FFF', abbr: 'RS' },
  // Messaging / Integration
  'amazon sns':             { bg: '#FF4F8B', abbr: 'SNS' },
  'amazon sqs':             { bg: '#FF4F8B', abbr: 'SQS' },
  'amazon ses':             { bg: '#1A9C3E', abbr: 'SES' },
  'amazon kinesis':         { bg: '#8C4FFF', abbr: 'Kin' },
  'amazon api gateway':     { bg: '#FF4F8B', abbr: 'API' },
  // Monitoring / Networking / Security
  'amazon cloudwatch':      { bg: '#E7157B', abbr: 'CW' },
  'cloudwatch':             { bg: '#E7157B', abbr: 'CW' },
  'amazon cloudfront':      { bg: '#8C4FFF', abbr: 'CF' },
  'cloudfront':             { bg: '#8C4FFF', abbr: 'CF' },
  'amazon route 53':        { bg: '#8C4FFF', abbr: 'R53' },
  'amazon vpc':             { bg: '#8C4FFF', abbr: 'VPC' },
  'amazon iam':             { bg: '#DD344C', abbr: 'IAM' },
  // AI / ML
  'amazon sagemaker':       { bg: '#2ECC71', abbr: 'SM' },
  'amazon bedrock':         { bg: '#232f3e', abbr: 'Bed' },
  // Identity
  'amazon cognito':         { bg: '#DD344C', abbr: 'Cog' },
  // Azure
  azure:                  { bg: '#0078d4', abbr: 'Az' },
  'microsoft azure':      { bg: '#0078d4', abbr: 'Az' },
  // Slack
  slack:                  { bg: '#4a154b', abbr: 'Sl' },
  // Canva
  canva:                  { bg: '#00c4cc', abbr: 'Cv' },
  // VS Code
  vscode:                 { bg: '#007acc', abbr: 'VS' },
  'visual studio code':   { bg: '#007acc', abbr: 'VS' },
  // Adobe suite
  photoshop:              { bg: '#001d34', abbr: 'Ps' },
  'adobe photoshop':      { bg: '#001d34', abbr: 'Ps' },
  illustrator:            { bg: '#ff9a00', textColor: '#000', abbr: 'Ai' },
  'adobe illustrator':    { bg: '#ff9a00', textColor: '#000', abbr: 'Ai' },
  'adobe xd':             { bg: '#ff61f6', abbr: 'XD' },
  xd:                     { bg: '#ff61f6', abbr: 'XD' },
  aftereffects:           { bg: '#9999ff', abbr: 'AE' },
  'after effects':        { bg: '#9999ff', abbr: 'AE' },
  premierepro:            { bg: '#9999ff', abbr: 'Pr' },
  'premiere pro':         { bg: '#9999ff', abbr: 'Pr' },
  lightroom:              { bg: '#31a8ff', abbr: 'Lr' },
  indesign:               { bg: '#ff3366', abbr: 'Id' },
  // C# / .NET
  'c#':                   { bg: '#512BD4', abbr: 'C#' },
  csharp:                 { bg: '#512BD4', abbr: 'C#' },
  // Windows
  windows:                { bg: '#0078d4', abbr: 'Win' },
  'microsoft windows':    { bg: '#0078d4', abbr: 'Win' },
  // OpenAI / LLMs
  openai:                 { bg: '#10a37f', abbr: 'OAI' },
  chatgpt:                { bg: '#10a37f', abbr: 'GPT' },
  'gpt-4':                { bg: '#10a37f', abbr: 'GPT' },
  gemini:                 { bg: '#4285f4', abbr: 'Gem' },
  'claude':               { bg: '#191919', abbr: 'Cl' },
  // Divi
  divi:                   { bg: '#5b5ea6', abbr: 'Di' },
  // Microsoft Office
  excel:                  { bg: '#217346', abbr: 'XL' },
  'microsoft excel':      { bg: '#217346', abbr: 'XL' },
  word:                   { bg: '#2b579a', abbr: 'Wd' },
  'microsoft word':       { bg: '#2b579a', abbr: 'Wd' },
  powerpoint:             { bg: '#d24726', abbr: 'PP' },
  'microsoft powerpoint': { bg: '#d24726', abbr: 'PP' },
  // Google Workspace
  'google sheets':        { bg: '#34a853', abbr: 'GS' },
  'google docs':          { bg: '#4285f4', abbr: 'GD' },
  'google slides':        { bg: '#fbbc04', textColor: '#000', abbr: 'GL' },
  'google analytics':     { bg: '#e37400', textColor: '#000', abbr: 'GA' },
  // ML platforms without icons
  xgboost:                { bg: '#33aadd', abbr: 'XGB' },
  lightgbm:               { bg: '#2980b9', abbr: 'LGB' },
  'hugging face':         { bg: '#FFD21E', textColor: '#000', abbr: 'HF' },
  wandb:                  { bg: '#FFBE00', textColor: '#000', abbr: 'W&B' },
  mlops:                  { bg: '#2c3e50', abbr: 'MLO' },
  'vector database':      { bg: '#6c3483', abbr: 'VDB' },
  pinecone:               { bg: '#000000', abbr: 'PC' },
  weaviate:               { bg: '#4fc1e9', abbr: 'Wv' },
  chroma:                 { bg: '#FF6B35', abbr: 'Chr' },
  qdrant:                 { bg: '#DC244C', abbr: 'Qd' },
  faiss:                  { bg: '#0066CC', abbr: 'FAISS' },
  // R language
  r:                      { bg: '#276DC3', abbr: 'R' },
  rstudio:                { bg: '#75AADB', abbr: 'RS' },
  // Scala / Java
  scala:                  { bg: '#DC322F', abbr: 'Sc' },
  java:                   { bg: '#ED8B00', textColor: '#000', abbr: 'Jv' },
  spring:                 { bg: '#6DB33F', abbr: 'Sp' },
  'spring boot':          { bg: '#6DB33F', abbr: 'SB' },
  // Misc
  rabbitmq:               { bg: '#FF6600', abbr: 'RMQ' },
  celery:                 { bg: '#37814A', abbr: 'Cel' },
}

// ── Merge all category maps into one unified lookup ─────────────────────────

const SI_ICONS_MAP: Record<string, IconEntry> = {
  // Generated from simple-icons npm package (176 brand logos)
  ...generated,
  // AWS service icons (hand-embedded SVG paths)
  ...awsServices,
  // Legacy hand-crafted entries (kept for any tools not in generated)
  ...ai,
  ...python,
  ...mern,
  ...frontend,
  ...wordpress,
  ...devops,
  ...cloud,
  ...database,
  ...mobile,
  ...collab,
}

export { SI_ICONS_MAP }
export default SI_ICONS_MAP
