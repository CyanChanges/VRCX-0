import { useTranslation } from 'react-i18next';

import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';
import { Input } from '@/ui/shadcn/input';

import { Field, FieldGroup } from '../SettingsField';

export function CustomFontDialog({
    open: customFontDialogOpen,
    onOpenChange: setCustomFontDialogOpen,
    draft: customFontDraft,
    onDraftChange: setCustomFontDraft,
    onSave: saveCustomFontFamily
}: any) {
    const { t } = useTranslation();

    return (
        <Dialog
            open={customFontDialogOpen}
            onOpenChange={setCustomFontDialogOpen}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            'view.settings.appearance.appearance.font_family_custom_dialog_title'
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'view.settings.appearance.appearance.font_family_custom_dialog_description'
                        )}
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field
                        label={t(
                            'view.settings.appearance.appearance.font_family_custom'
                        )}
                        controlId="settings-custom-font-family"
                    >
                        <Input
                            id="settings-custom-font-family"
                            value={customFontDraft}
                            name="customFontFamily"
                            placeholder="'My Font', Arial, sans-serif"
                            onChange={(event: any) =>
                                setCustomFontDraft(event.target.value)
                            }
                            onKeyDown={(event: any) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    saveCustomFontFamily();
                                }
                            }}
                        />
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCustomFontDialogOpen(false)}
                    >
                        {t('dialog.alertdialog.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            saveCustomFontFamily();
                        }}
                    >
                        {t('dialog.alertdialog.ok')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
