# player.getTextTrack()

## Description

Get information about the text track currently set.
`null` if no audio track is enabled right now.

If a text track is set and information about it is known, this method will
return an object with the following properties:

- `id` (`Number|string`): The id used to identify this track. No other
  text track for the same [Period](../../Getting_Started/Glossary.md#period) will have the same
  `id`.

  This can be useful when setting the track through the `setTextTrack` method.

- `language` (`string`): The language the text trac./../Basic_Methods/loadVideo.md#transport set in the
  [Manifest](../../Getting_Started/Glossary.md#manifest).

- `normalized` (`string`): An attempt to translate the `language`
  property into an ISO 639-3 language code (for now only support translations
  from ISO 639-1 and ISO 639-3 language codes). If the translation attempt
  fails (no corresponding ISO./../Basic_Methods/loadVideo.md#transport found), it will equal the
  value of `language`

- `closedCaption` (`Boolean`): Whether the track is specially adapted for
  the hard of hearing or not.

`undefined` if no text content has been loaded yet or if its information is
unknown.

:::note
Note for multi-Period contents:

This method will only return the chosen text track for the
[Period](../../Getting_Started/Glossary.md#period) that is currently playing.
:::

<div class="warning">
In <i>DirectFile</i> mode (see <a
href="../Loading_a_Content.md#transport">loadVideo options</a>), if there is no
text tracks API in the browser, this method returns "undefined".
</div>

## Syntax

```js
const textTrack = player.getTextTrack();
```

 - **return value** `Object|null|undefined`