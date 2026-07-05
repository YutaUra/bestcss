// fake-ui はテスト実行時（beforeAll）に node_modules へ生成されるため、
// typecheck 時には実体が存在しない。型だけここで宣言する
declare module "fake-ui" {
  export const shared: string;
  export const libOnly: string;
}

declare module "fake-ui/style.css";
