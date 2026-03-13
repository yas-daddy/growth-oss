

# Allow Manual Channel Input for Affiliates

## Overview
Update the affiliate creation/edit dialog to support both selecting an existing AppsFlyer channel and manually typing a new channel name. This lets you onboard partners before they have any AppsFlyer data.

**Critical**: The channel value must exactly match the `media_source` string that AppsFlyer will later report for that partner, otherwise FTD attribution, spend tracking, and dashboard metrics won't link up.

## Changes

### `src/components/affiliates/AffiliateDialog.tsx`

1. **Replace the Select-only channel field** with an `Input` + `datalist` combo that shows existing AppsFlyer channels as autocomplete suggestions but also allows free-text entry.

2. **Add helper text** below the input explaining: "Must exactly match the media source name in AppsFlyer (e.g. `partner_name_int`)."

3. **Trim and normalise on submit**: Call `.trim()` on the channel value before saving to avoid accidental whitespace mismatches.

4. **Remove the `!formData.channel` disable condition** on the submit button — the `required` attribute on the input handles validation natively.

### Technical Details

- Replace the `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` block for channel with:
  ```tsx
  <Input
    id="channel"
    value={formData.channel}
    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
    list="channel-suggestions"
    placeholder="Type or select a channel"
    required
  />
  <datalist id="channel-suggestions">
    {availableChannels.map((ch) => (
      <option key={ch} value={ch} />
    ))}
  </datalist>
  <p className="text-xs text-muted-foreground">
    Must exactly match the media source name in AppsFlyer (e.g. partner_name_int)
  </p>
  ```
- In `handleSubmit`, trim the channel: `channel: formData.channel.trim()`
- Update the label to "Channel (Media Source) *"
