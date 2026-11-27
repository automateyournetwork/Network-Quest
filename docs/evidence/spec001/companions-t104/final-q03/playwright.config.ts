import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'all-seven.spec.ts',fullyParallel:false,workers:1,retries:0,reporter:[['line']],outputDir:'../../../../../.local/t104-final-native-results',use:{trace:'off',screenshot:'only-on-failure'}});
