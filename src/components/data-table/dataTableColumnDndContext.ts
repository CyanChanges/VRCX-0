import { createContext, useContext } from 'react';

export const dataTableColumnDndDefaultState: any = {
    enabled: false,
    items: [],
    table: null
};

export const DataTableColumnDndContext = createContext(
    dataTableColumnDndDefaultState
);

export function useDataTableColumnDnd() {
    return useContext(DataTableColumnDndContext);
}
