import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 16,
    fontSizeHeading4: 14,
    colorTextDisabled: '#000000',
  },
  components: {
    Typography: { titleMarginBottom: 0, titleMarginTop: 0 },
    Button: {
      fontWeight: 500,
      borderRadius: 4,
    },
    Input: { colorTextDisabled: '#000000' },
    Select: { colorTextDisabled: '#000000' },
  },
};

export default theme;
