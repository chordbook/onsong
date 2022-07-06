module.exports = class Metadata {
  constructor(metatags) {
    metatags.forEach(metatag => {
      this[metatag.name] = metatag.value
    });
  }
}
