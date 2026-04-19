declare module '*.module.scss' {
  const resource: { [key: string]: string };
  export = resource;
}

declare module '*.module.css' {
  const resource: { [key: string]: string };
  export = resource;
}
