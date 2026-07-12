import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
// 獨立於 vite.config.ts 之外(避免 tsc -b 對 test 欄位的型別擴充解析不穩定的問題),
// 用 mergeConfig 疊上既有的 vite 設定(plugins/base 等),而不是重複寫一份。
export default mergeConfig(viteConfig, defineConfig({
    test: {
        environment: 'jsdom',
    },
}));
