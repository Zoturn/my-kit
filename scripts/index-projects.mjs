#!/usr/bin/env node
// Builds the knowledge index of your past projects: ~/.my-kit/knowledge/projects.json
// Used by /kit-new to suggest a language and tools based on what you already use.
// Local only (it contains NDA project names): never copy it into the kit repo.
// Usage: node scripts/index-projects.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectStacks, loadConfig, readPkg, scan } from '../lib/projects.mjs';

const root = process.env.KIT_HOME || join(homedir(), '.my-kit');
const out = join(root, 'knowledge', 'projects.json');

const CATEGORIES = {
  api: ['express', '@nestjs/core', 'fastify', 'koa', '@apollo/server', 'apollo-server', 'graphql', '@trpc/server', '@strapi/strapi'],
  orm: ['prisma', '@prisma/client', 'typeorm', 'sequelize', 'mongoose', 'drizzle-orm', 'knex'],
  database: ['pg', 'postgres', 'mongodb', 'mysql2', '@aws-sdk/client-dynamodb', 'redis', 'ioredis'],
  testing: ['jest', 'vitest', 'cypress', '@testing-library/react', 'playwright', '@playwright/test', 'mocha'],
  ui: ['@mui/material', 'antd', '@chakra-ui/react', 'bootstrap', 'tailwindcss', 'styled-components', 'sass'],
  state: ['redux', '@reduxjs/toolkit', 'zustand', 'mobx', 'recoil', '@tanstack/react-query', 'swr'],
  auth: ['passport', 'next-auth', 'jsonwebtoken', '@nestjs/passport', 'firebase'],
  realtime: ['socket.io', 'socket.io-client', 'ws'],
  cloud: ['aws-sdk', '@supabase/supabase-js', 'firebase', 'firebase-admin'],
  mobile: ['react-native', 'expo'],
  frontend_other: ['vue', 'nuxt', 'vite', 'storybook', '@storybook/react'],
};

const git = (cwd, args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

const projects = [];
for (const r of loadConfig().roots) {
  if (!existsSync(r.path)) continue;
  for (const dir of scan(r.path).found) {
    let pkg;
    try { pkg = readPkg(dir); } catch { continue; }
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).sort();
    projects.push({
      name: relative(r.path, dir),
      root: r.path,
      sensitivity: r.sensitivity,
      stacks: detectStacks(dir, pkg),
      deps,
      scripts: Object.keys(pkg.scripts || {}),
      lastCommit: git(dir, ['log', '-1', '--format=%cs']).stdout.trim() || null,
    });
  }
}

const count = (items) => items.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
const summary = {
  projects: projects.length,
  stacks: count(projects.flatMap((p) => p.stacks)),
  categories: Object.fromEntries(
    Object.entries(CATEGORIES).map(([cat, names]) => [
      cat,
      Object.fromEntries(
        names.map((n) => [n, projects.filter((p) => p.deps.includes(n)).length]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]),
      ),
    ]),
  ),
};

mkdirSync(join(root, 'knowledge'), { recursive: true });
writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), summary, projects }, null, 2));
console.log(`Indexed ${projects.length} project(s) → ${out}`);
