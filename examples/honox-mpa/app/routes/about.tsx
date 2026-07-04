import { createRoute } from "honox/factory";
import { Layout, Title } from "../components/ui.js";

export default createRoute((c) => {
  return c.render(
    <Layout>
      <Title>About</Title>
      <p>2 ページ目。共有コンポーネントのスタイルが同じクラス名で当たる。</p>
    </Layout>,
    { title: "About | bestcss × HonoX" },
  );
});
