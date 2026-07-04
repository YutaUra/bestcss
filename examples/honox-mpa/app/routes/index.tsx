import { createRoute } from "honox/factory";
import { Layout, Title } from "../components/ui.js";
import Counter from "../islands/counter.js";

export default createRoute((c) => {
  return c.render(
    <Layout>
      <Title>best-css × HonoX</Title>
      <p>サーバーレンダリングされた MPA のページ。ボタンは island。</p>
      <Counter />
    </Layout>,
    { title: "Home | best-css × HonoX" },
  );
});
